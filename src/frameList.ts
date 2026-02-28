import {
  JSONRPCClient,
  type JSONRPCRequest,
  JSONRPCServer,
  JSONRPCServerAndClient,
  type TypedJSONRPCServerAndClient,
} from "json-rpc-2.0";
import * as vscode from "vscode";
import type PcapDocument from "./pcapDocument";
import type {
  FrameListMethods,
  FrameListWebviewMethods,
  InitResponse,
} from "./types/frameList";

export default class FrameList {
  #document: PcapDocument;
  #webviewPanel: vscode.WebviewPanel;
  #context: vscode.ExtensionContext;
  #rpc: TypedJSONRPCServerAndClient<FrameListMethods, FrameListWebviewMethods>;

  constructor(
    document: PcapDocument,
    webviewPanel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
  ) {
    this.#document = document;
    this.#webviewPanel = webviewPanel;
    this.#context = context;

    // Setup webview
    this.#webviewPanel.webview.options = { enableScripts: true };
    this.#webviewPanel.webview.html = this.#generateWebviewHtml();

    // Setup API
    this.#rpc = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient((request: JSONRPCRequest) => {
        this.#webviewPanel.webview.postMessage(request);
      }),
    );

    this.#webviewPanel.webview.onDidReceiveMessage((message) => {
      this.#rpc.receiveAndSend(message);
    });

    this.#rpc.addMethod("init", async () => {
      return await vscode.window.withProgress<InitResponse>(
        {
          title: `Loading ${this.#document.uri.path}`,
          location: vscode.ProgressLocation.Notification,
        },
        async (progress, _token) => {
          try {
            const client = await this.#document.sharkd.getClient();
            await client.request("load", { file: this.#document.uri.path });

            progress.report({ increment: 70 });
            const analyse = await client.request("analyse");

            progress.report({ increment: 20 });
            const config =
              vscode.workspace.getConfiguration("crumbs.frameList");
            const colorCoding = config.get<boolean>("colorCoding", false);
            const columns = this.#getColumns();

            progress.report({ increment: 100 });
            return {
              numRows: analyse.frames,
              columnHeaders: Object.keys(columns),
              colorCoding: colorCoding,
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            progress.report({ increment: 100 });
            vscode.window.showErrorMessage(
              `Failed to load ${this.#document.uri.path}: ${message}`,
            );
            throw err;
          }
        },
      );
    });

    this.#rpc.addMethod("frames", async ({ startIndex, endIndex }) => {
      const client = await this.#document.sharkd.getClient();
      const info = await client.request("info");

      const columns = this.#getColumns();
      const columnFields = Object.values(columns || {}).reduce(
        (acc, item, index) => {
          acc[`column${index}`] = item.startsWith("%")
            ? info.columns.findIndex((col) => col.format === item)
            : item.search(/:\d+$/) > 0
              ? item
              : `${item}:0`;
          return acc;
        },
        {} as Record<string, string | number>,
      );

      const frames = await client.request("frames", {
        skip: startIndex === 0 ? undefined : startIndex,
        limit: endIndex - startIndex,
        ...columnFields,
      });

      return { frames: frames };
    });

    this.#rpc.addMethod("focus", async ({ frameId, reveal }) => {
      const client = await this.#document.sharkd.getClient();
      const frame = await client.request("frame", {
        frame: frameId,
        bytes: true,
        proto: true,
      });

      this.#context.workspaceState.update("currentFrame", frame);

      await vscode.commands
        .executeCommand("frameTreeUpdateFrame")
        .then(undefined, () => {});

      await vscode.commands
        .executeCommand("frameHexUpdateFrame")
        .then(undefined, () => {});

      if (reveal) {
        await vscode.commands
          .executeCommand("frameTreeReveal")
          .then(undefined, () => {});
      }
    });
  }

  #getColumns(): { [key: string]: string } {
    const config = vscode.workspace.getConfiguration("crumbs.frameList");
    const columns = config.get<{ [key: string]: string }>("columns");
    if (!columns || Object.keys(columns).length === 0) {
      // biome-ignore-start lint/style/useNamingConvention: using upper case for column headers
      return {
        Number: "%m",
        Time: "%t",
        Source: "%s",
        Destination: "%d",
        Protocol: "%p",
        Length: "%L",
        Info: "%i",
      };
      // biome-ignore-end lint/style/useNamingConvention: using upper case for column headers
    }

    return columns;
  }

  #generateWebviewHtml(): string {
    const scriptUri = this.#webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.#context.extensionUri, "dist", "framelist.js"),
    );
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="${scriptUri}"></script>
          <style>
            html, body, #root {
              width: 100%;
              height: 100%;
              padding: 0;
            }
          </style>
        </head>
        <body>
          <div id="root"/>
        </body>
      </html>`;
  }
}
