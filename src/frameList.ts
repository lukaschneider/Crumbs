import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
  type TypedJSONRPCServerAndClient,
} from "json-rpc-2.0";
import * as vscode from "vscode";
import { defaultColumns, getColumnFields } from "./columns";
import { framePage } from "./framePaging";
import type { FrameSelection } from "./frameSelection";
import type PcapDocument from "./pcapDocument";
import type {
  FrameListMethods,
  FrameListWebviewMethods,
  InitResponse,
} from "./types/frameList";
import type { FrameResponse, FramesResponse } from "./types/sharkd";
import { webviewHtml } from "./webviewHtml";
import type { FilterHistory } from "./filterHistory";
import type {
  FilterMode,
  FilterOperation,
  FilterState,
} from "./types/displayFilter";
import { combineFilter } from "./filterSyntax";

export default class FrameList {
  #rpc: TypedJSONRPCServerAndClient<FrameListMethods, FrameListWebviewMethods>;
  #frame?: FrameResponse;
  #frameId?: number;
  #pendingFrame?: { id: number; promise: Promise<FrameResponse> };
  #disposed = false;
  #initialized?: Promise<Omit<InitResponse, "filterState" | "history">>;
  #filter: FilterState = { filter: "", revision: 0, numRows: 0 };
  #applying = 0;
  #columnFields: Record<`column${number}`, string | number> = {};
  #disposables: vscode.Disposable[] = [];

  constructor(
    private readonly document: PcapDocument,
    private readonly panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    private readonly selection: FrameSelection,
    private readonly history: FilterHistory,
  ) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
    };
    this.#rpc = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient(async (message) => {
        if (!this.#disposed) {
          await panel.webview.postMessage(message);
        }
      }),
    );
    this.#disposables.push(
      history.onDidChange((items) => this.#rpc.notify("history", items)),
      panel.webview.onDidReceiveMessage((message) => {
        void this.#rpc.receiveAndSend(message);
      }),
      panel.onDidChangeViewState(() => {
        if (panel.active) {
          selection.activate(this, this.#frame);
        }
      }),
      panel.onDidDispose(() => {
        this.#disposed = true;
        this.#applying++;
        selection.clear(this);
        this.#rpc.rejectAllPendingRequests("Editor closed");
        this.#disposables.forEach((disposable) => {
          disposable.dispose();
        });
      }),
    );
    if (panel.active) {
      selection.activate(this);
    }
    this.#rpc.addMethod("init", async () => {
      const init = await this.#init();
      if (!this.#filter.filter) {
        this.#filter.numRows = init.numRows;
      }
      return {
        ...init,
        filterState: { ...this.#filter },
        history: history.items,
      };
    });
    this.#rpc.addMethod("retry", () => {
      document.reset();
      this.#applying++;
      this.#filter = {
        filter: "",
        numRows: 0,
        revision: this.#filter.revision + 1,
      };
      this.#initialized = undefined;
      this.#pendingFrame = undefined;
      this.#frame = undefined;
      this.#frameId = undefined;
      if (panel.active) {
        selection.activate(this);
      }
    });
    this.#rpc.addMethod("openSettings", async ({ setting }) => {
      const allowed = ["sharkd", "profile", "frameList.columns"];
      const query = allowed.includes(setting) ? `crumbs.${setting}` : "crumbs";
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        query,
      );
    });
    this.#rpc.addMethod("showLog", async () => {
      await vscode.commands.executeCommand("crumbs.showOutput");
    });
    this.#rpc.addMethod("validateFilter", ({ filter }) =>
      document.filters.validate(filter),
    );
    this.#rpc.addMethod("completeFilter", ({ text, cursor }) =>
      document.filters.complete(text, cursor),
    );
    this.#rpc.addMethod("applyFilter", ({ filter }) =>
      this.#applyFilter(filter),
    );
    this.#rpc.addMethod("filterHistory", async ({ remove }) => {
      await history.remove(remove);
      return history.items;
    });
    this.#rpc.addMethod(
      "frames",
      async ({ startIndex, endIndex, revision }) => {
        const page = framePage(startIndex, endIndex);
        await this.#init();
        const filter = this.#filter;
        if (revision !== undefined && revision !== filter.revision) {
          throw new Error("Filter changed");
        }
        const { client } = await document.load();
        let frames: FramesResponse[];
        try {
          frames = await client.request("frames", {
            ...page,
            ...this.#columnFields,
            ...(filter.filter ? { filter: filter.filter } : {}),
          });
        } catch (error) {
          document.reportError(error);
          throw error;
        }
        return { frames, revision: filter.revision };
      },
    );
    this.#rpc.addMethod(
      "focus",
      async ({ frameId, reveal, revision: filterRevision }) => {
        if (this.#disposed || !panel.active) {
          return;
        }
        if (
          filterRevision !== undefined &&
          filterRevision !== this.#filter.revision
        ) {
          return;
        }
        const currentFilter = this.#filter.revision;
        if (!Number.isSafeInteger(frameId) || frameId < 1) {
          throw new Error("Invalid frame number");
        }
        if (this.#frameId === frameId && selection.frame === this.#frame) {
          // Moving between columns in one row must not re-fetch the packet.
          if (reveal) {
            await vscode.commands.executeCommand("frameTreeReveal");
          }
          return;
        }
        const revision = selection.begin(this);
        if (this.#pendingFrame?.id !== frameId) {
          const promise = document.load().then(({ client }) =>
            client.request("frame", {
              frame: frameId,
              bytes: true,
              proto: true,
            }),
          );
          this.#pendingFrame = { id: frameId, promise };
        }
        const pending = this.#pendingFrame;
        let frame: FrameResponse;
        try {
          frame = await pending.promise;
        } finally {
          if (this.#pendingFrame === pending) {
            this.#pendingFrame = undefined;
          }
        }
        if (
          this.#disposed ||
          currentFilter !== this.#filter.revision ||
          !selection.commit(this, revision, frame)
        ) {
          return;
        }
        this.#frame = frame;
        this.#frameId = frameId;
        document.filters.observe(frame);
        if (reveal) {
          await vscode.commands.executeCommand("frameTreeReveal");
        }
      },
    );
    // Install listeners and methods before the webview can send init.
    panel.webview.html = webviewHtml(
      panel.webview,
      vscode.Uri.joinPath(context.extensionUri, "dist", "framelist.js"),
    );
  }

  async filterFromTree(
    expression: string,
    mode: FilterMode,
    operation: FilterOperation,
  ) {
    if (this.#disposed) {
      return;
    }
    const filter = combineFilter(this.#filter.filter, expression, operation);
    if (mode === "apply") {
      await this.#applyFilter(filter);
    } else {
      this.#applying++;
      this.panel.reveal(this.panel.viewColumn, false);
      this.#rpc.notify("prepareFilter", { filter });
    }
  }

  async #applyFilter(text: string) {
    const attempt = ++this.#applying;
    const filter = text.trim();
    const validation = await this.document.filters.validate(filter);
    if (!validation.valid) {
      throw new Error(validation.message ?? "Invalid display filter");
    }
    const numRows = await this.document.filters.count(filter);
    if (attempt !== this.#applying || this.#disposed) {
      throw new Error("Filter request superseded");
    }
    this.#filter = { filter, numRows, revision: this.#filter.revision + 1 };
    // A different result set invalidates row positions and pending packet selection.
    this.#frame = undefined;
    this.#frameId = undefined;
    this.#pendingFrame = undefined;
    if (this.selection.owner === this) {
      this.selection.activate(this);
    }
    this.#rpc.notify("filter", this.#filter);
    if (filter) {
      void this.history
        .add(filter)
        .catch((error) => this.document.reportError(error));
    }
    return this.#filter;
  }

  #init() {
    this.#initialized ??= Promise.resolve(
      vscode.window.withProgress<Omit<InitResponse, "filterState" | "history">>(
        {
          title: `Loading ${this.document.uri.fsPath}`,
          location: vscode.ProgressLocation.Notification,
        },
        async () => {
          try {
            const { analyse, info } = await this.document.load();
            const config = vscode.workspace.getConfiguration(
              "crumbs.frameList",
              this.document.uri,
            );
            const columns = config.get<Record<string, string>>(
              "columns",
              defaultColumns,
            );
            this.#columnFields = getColumnFields(columns, info);
            return {
              numRows: analyse.frames,
              columnHeaders: Object.keys(columns),
              colorCoding: config.get("colorCoding", true),
            };
          } catch (error) {
            this.document.reportError(error);
            throw error;
          }
        },
      ),
    ).then(
      (result) => result,
      (error) => {
        this.#initialized = undefined;
        throw error;
      },
    );
    return this.#initialized;
  }
}
