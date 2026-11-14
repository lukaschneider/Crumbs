import { describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { JSONRPCClient } from "json-rpc-2.0";
import { EventEmitter, commands, configuration, window } from "./vscode";
import FrameList from "../src/frameList";
import type PcapDocument from "../src/pcapDocument";
import { FrameSelection } from "../src/frameSelection";
import type { FrameResponse } from "../src/types/sharkd";
import { FilterHistory } from "../src/filterHistory";
import FrameTreeProvider from "../src/frameTreeProvider";
import type {
  FrameTreeDataProvider,
  FrameTreeItem,
} from "../src/frameTreeDataProvider";

function editor(
  request = vi.fn().mockResolvedValue([]),
  shared?: {
    document: PcapDocument;
    selection: FrameSelection;
    history: FilterHistory;
  },
) {
  const incoming = new EventEmitter<unknown>();
  const state = new EventEmitter<void>();
  const closed = new EventEmitter<void>();
  const rpc = new JSONRPCClient((message) => incoming.fire(message));
  const panel = {
    active: true,
    reveal: vi.fn(),
    webview: {
      options: {},
      html: "",
      cspSource: "https://webview.example",
      asWebviewUri: (uri: vscode.Uri) => uri,
      postMessage: vi.fn(async (message) => {
        rpc.receive(message);
        return true;
      }),
      onDidReceiveMessage: incoming.event,
    },
    onDidChangeViewState: state.event,
    onDidDispose: closed.event,
  };
  const document = {
    reset: vi.fn(),
    reportError: vi.fn(),
    uri: vscode.Uri.file("capture.pcap"),
    load: vi.fn(async () => ({
      client: { request },
      analyse: { frames: 10 },
      info: { columns: [{ name: "Number", format: "%m" }] },
    })),
    filters: {
      validate: vi.fn(async () => ({ valid: true })),
      count: vi.fn(async () => 3),
      observe: vi.fn(),
      complete: vi.fn(),
    },
  };
  configuration["crumbs.frameList.columns"] = { number: "%m" };
  const selection = shared?.selection ?? new FrameSelection();
  const history =
    shared?.history ??
    new FilterHistory({
      get: () => [],
      update: vi.fn(async () => {}),
      keys: () => [],
    } as unknown as vscode.Memento);
  const list = new FrameList(
    shared?.document ?? (document as unknown as PcapDocument),
    panel as unknown as vscode.WebviewPanel,
    { extensionUri: vscode.Uri.file("extension") } as vscode.ExtensionContext,
    selection,
    history,
  );
  return {
    rpc,
    panel,
    state,
    closed,
    selection,
    request,
    document,
    list,
    history,
  };
}

describe("frame list RPC", () => {
  it("routes native tree commands to the selected editor and ignores stale tree items", async () => {
    const { rpc, list, selection } = editor(
      vi
        .fn()
        .mockResolvedValue({ tree: [{ l: "Port", f: "udp.srcport == 53" }] }),
    );
    const subscriptions: vscode.Disposable[] = [];
    new FrameTreeProvider(
      { subscriptions } as vscode.ExtensionContext,
      selection,
    );
    await rpc.request("focus", { frameId: 1, reveal: false });
    const options = window.createTreeView.mock.calls.at(-1)?.[1] as {
      treeDataProvider: FrameTreeDataProvider;
    };
    const item = options.treeDataProvider.getChildren()[0];
    expect(item.contextValue).toBe("crumbsFilterable");
    const calls = commands.registerCommand.mock.calls as unknown as [
      string,
      (item: FrameTreeItem) => Promise<void>,
    ][];
    const prepare = calls.find(
      ([name]) => name === "crumbs.filter.prepare.or",
    )?.[1];
    expect(prepare).toBeDefined();
    const fromTree = vi.spyOn(list, "filterFromTree").mockResolvedValue();
    await prepare?.(item);
    expect(fromTree).toHaveBeenCalledWith("udp.srcport == 53", "prepare", "or");
    selection.activate(list, {
      tree: [{ l: "New port", f: "udp.srcport == 80" }],
    });
    await prepare?.(item);
    expect(fromTree).toHaveBeenCalledTimes(1);
    subscriptions.forEach((disposable) => {
      disposable.dispose();
    });
  });
  it("keeps split-pane filters independent while sharing history and the capture", async () => {
    const first = editor();
    const second = editor(first.request, {
      document: first.document as unknown as PcapDocument,
      selection: first.selection,
      history: first.history,
    });
    await Promise.all([
      first.rpc.request("init", undefined),
      second.rpc.request("init", undefined),
    ]);
    await first.rpc.request("applyFilter", { filter: "udp" });
    await second.rpc.request("applyFilter", { filter: "dns" });
    await first.rpc.request("frames", {
      startIndex: 0,
      endIndex: 100,
      revision: 1,
    });
    expect(first.request).toHaveBeenLastCalledWith("frames", {
      filter: "udp",
      limit: 100,
      column0: 0,
    });
    await second.rpc.request("frames", {
      startIndex: 0,
      endIndex: 100,
      revision: 1,
    });
    expect(first.request).toHaveBeenLastCalledWith("frames", {
      filter: "dns",
      limit: 100,
      column0: 0,
    });
    expect(first.history.items).toEqual(["dns", "udp"]);
  });
  it("leaves results, history and selection intact when a filter is invalid", async () => {
    const { rpc, document, selection, history } = editor(
      vi.fn().mockResolvedValue({ bytes: "AA==" }),
    );
    await rpc.request("applyFilter", { filter: "udp" });
    await rpc.request("focus", { frameId: 1, reveal: false, revision: 1 });
    document.filters.validate.mockResolvedValueOnce({ valid: false });
    await expect(
      rpc.request("applyFilter", { filter: "udp ==" }),
    ).rejects.toThrow("Invalid");
    expect(selection.frame?.bytes).toBe("AA==");
    expect(history.items).toEqual(["udp"]);
    expect(await rpc.request("init", undefined)).toMatchObject({
      filterState: { filter: "udp", revision: 1 },
    });
  });
  it("rejects superseded applies and stale paging and packet selection", async () => {
    const { rpc, document, request, history, selection } = editor();
    let finish: (value: number) => void = () => {};
    document.filters.count.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const old = rpc.request("applyFilter", { filter: "tcp" });
    const rejected = expect(old).rejects.toThrow("superseded");
    await vi.waitFor(() =>
      expect(document.filters.count).toHaveBeenCalledTimes(1),
    );
    const state = await rpc.request("applyFilter", { filter: "udp" });
    finish(9);
    await rejected;
    expect(state).toMatchObject({ filter: "udp", numRows: 3, revision: 1 });
    expect(history.items).toEqual(["udp"]);
    await expect(
      rpc.request("frames", { startIndex: 0, endIndex: 100, revision: 0 }),
    ).rejects.toThrow("Filter changed");
    await rpc.request("focus", { frameId: 1, reveal: false, revision: 0 });
    expect(request).not.toHaveBeenCalled();
    expect(selection.frame).toBeUndefined();
  });
  it("prepares a grouped expression without applying or saving it", async () => {
    const { rpc, list, panel, history } = editor();
    await rpc.request("applyFilter", { filter: "tcp || udp" });
    await list.filterFromTree("udp.srcport == 53", "prepare", "and-not");
    expect(panel.reveal).toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      method: "prepareFilter",
      params: { filter: "(tcp || udp) && !(udp.srcport == 53)" },
    });
    expect(history.items).toEqual(["tcp || udp"]);
    expect(await rpc.request("init", undefined)).toMatchObject({
      filterState: { filter: "tcp || udp", revision: 1 },
    });
  });
  it("restarts the session, clears stale selection, and reinitializes on retry", async () => {
    const { rpc, document, selection } = editor(
      vi.fn().mockResolvedValue({ bytes: "AA==" }),
    );
    await rpc.request("init", undefined);
    await rpc.request("focus", { frameId: 1, reveal: false });
    expect(selection.frame).toBeDefined();
    await rpc.request("retry", undefined);
    expect(document.reset).toHaveBeenCalledOnce();
    expect(selection.frame).toBeUndefined();
    const before = document.load.mock.calls.length;
    await rpc.request("init", undefined);
    expect(document.load).toHaveBeenCalledTimes(before + 1);
  });
  it("opens only supported settings and the diagnostic log", async () => {
    const { rpc } = editor();
    await rpc.request("openSettings", { setting: "profile" });
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      "workbench.action.openSettings",
      "crumbs.profile",
    );
    await rpc.request("openSettings", { setting: "unrelated-setting" });
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      "workbench.action.openSettings",
      "crumbs",
    );
    await rpc.request("showLog", undefined);
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      "crumbs.showOutput",
    );
  });
  it("initializes before script loading, uses bounded paging and stable configured columns", async () => {
    const { rpc, request, panel } = editor();
    expect(panel.webview.html).toContain("Content-Security-Policy");
    expect(panel.webview.html).toContain("defer");
    expect(await rpc.request("init", undefined)).toEqual({
      numRows: 10,
      columnHeaders: ["number"],
      colorCoding: true,
      filterState: { filter: "", revision: 0, numRows: 10 },
      history: [],
    });
    await rpc.request("frames", { startIndex: 0, endIndex: 100 });
    await rpc.request("frames", { startIndex: 100, endIndex: 200 });
    expect(request).toHaveBeenNthCalledWith(1, "frames", {
      limit: 100,
      column0: 0,
    });
    expect(request).toHaveBeenNthCalledWith(2, "frames", {
      skip: 100,
      limit: 100,
      column0: 0,
    });
  });
  it("rejects invalid ranges without forwarding them", async () => {
    const { rpc, request } = editor();
    await expect(
      rpc.request("frames", { startIndex: -1, endIndex: 1 }),
    ).rejects.toThrow("Invalid");
    await expect(
      rpc.request("frames", { startIndex: 0, endIndex: 0 }),
    ).rejects.toThrow("Invalid");
    await expect(
      rpc.request("focus", { frameId: 0, reveal: false }),
    ).rejects.toThrow("Invalid");
    expect(request).not.toHaveBeenCalled();
  });
  it("keeps the newest response and restores cached selection on activation", async () => {
    const pending = new Map<number, (value: FrameResponse) => void>();
    const request = vi.fn(
      (_method, params) =>
        new Promise<FrameResponse>((resolve) =>
          pending.set(params.frame, resolve),
        ),
    );
    const { rpc, selection, panel, state } = editor(request);
    const first = rpc.request("focus", { frameId: 1, reveal: false });
    const second = rpc.request("focus", { frameId: 2, reveal: false });
    await vi.waitFor(() => expect(pending.size).toBe(2));
    pending.get(2)?.({ bytes: "second" });
    await second;
    pending.get(1)?.({ bytes: "first" });
    await first;
    expect(selection.frame?.bytes).toBe("second");
    panel.active = false;
    selection.activate({}, { bytes: "another editor" });
    panel.active = true;
    state.fire();
    expect(selection.frame?.bytes).toBe("second");
  });
  it("deduplicates concurrent and repeated requests for the same packet", async () => {
    const { rpc, request } = editor(
      vi.fn().mockResolvedValue({ bytes: "AA==" }),
    );
    await Promise.all([
      rpc.request("focus", { frameId: 1, reveal: false }),
      rpc.request("focus", { frameId: 1, reveal: true }),
    ]);
    await rpc.request("focus", { frameId: 1, reveal: false });
    expect(request).toHaveBeenCalledTimes(1);
    expect(commands.executeCommand).toHaveBeenCalledWith("frameTreeReveal");
  });
  it("ignores inactive panels and late responses after disposal", async () => {
    let finish: (frame: FrameResponse) => void = () => {};
    const { rpc, panel, request, closed, selection } = editor(
      vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    panel.active = false;
    await rpc.request("focus", { frameId: 1, reveal: false });
    expect(request).not.toHaveBeenCalled();
    panel.active = true;
    // Disposed webviews cannot receive the response, so observe the host state.
    rpc.notify("focus", { frameId: 1, reveal: false });
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    closed.fire();
    finish({ bytes: "late" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(selection.frame).toBeUndefined();
  });
});
