import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { commands, configuration, workspace } from "./vscode";
import PcapDocument from "../src/pcapDocument";
import { Sharkd } from "../src/sharkd";
import { FrameSelection } from "../src/frameSelection";
import { FrameTreeDataProvider } from "../src/frameTreeDataProvider";
import FrameTreeProvider from "../src/frameTreeProvider";
import { getHexFrame } from "../src/hexData";
import { getColumnFields } from "../src/columns";
import { toGridRow } from "../src/webview/frameListModel";
import type { InfoResponse, TreeNode } from "../src/types/sharkd";

beforeEach(() => vi.clearAllMocks());

describe("capture lifecycle", () => {
  it("retry creates a new reader and rereads the current settings", async () => {
    const document = new PcapDocument(vscode.Uri.file("capture.pcap"));
    const original = document.sharkd;
    const stop = vi.spyOn(original, "stop");
    configuration["crumbs.sharkd"] = "custom-sharkd";
    try {
      document.reset();
      expect(stop).toHaveBeenCalledOnce();
      expect(document.sharkd).not.toBe(original);
      expect(workspace.getConfiguration).toHaveBeenCalledTimes(2);
    } finally {
      delete configuration["crumbs.sharkd"];
      document.dispose();
    }
    expect(() => document.reset()).toThrow("closed");
  });
  it("an older failed load cannot evict the new session's cached load", async () => {
    let fail: (error: Error) => void = () => {};
    const request = vi.fn().mockResolvedValue({});
    vi.spyOn(Sharkd.prototype, "getClient")
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      )
      .mockResolvedValue({ request } as unknown as Awaited<
        ReturnType<Sharkd["getClient"]>
      >);
    const document = new PcapDocument(vscode.Uri.file("capture.pcap"));
    const first = expect(document.load()).rejects.toThrow("old session");
    document.reset();
    const second = document.load();
    fail(new Error("old session"));
    await first;
    await second;
    expect(document.load()).toBe(second);
    document.dispose();
  });
  it("loads native paths once for concurrent and split editors", async () => {
    const request = vi.fn(async (method: string) =>
      method === "analyse"
        ? { frames: 2 }
        : method === "info"
          ? { columns: [] }
          : { status: "OK" },
    );
    vi.spyOn(Sharkd.prototype, "getClient").mockResolvedValue({
      request,
    } as unknown as Awaited<ReturnType<Sharkd["getClient"]>>);
    const stop = vi.spyOn(Sharkd.prototype, "stop");
    const uri = {
      fsPath: "C:\\captures\\space name.pcap",
      path: "/C:/captures/space name.pcap",
    } as vscode.Uri;
    const document = new PcapDocument(uri);
    const [first, second] = await Promise.all([
      document.load(),
      document.load(),
    ]);
    expect(first).toBe(second);
    await document.load();
    expect(
      request.mock.calls.filter(([method]) => method === "load"),
    ).toHaveLength(1);
    expect(request).toHaveBeenCalledWith("load", { file: uri.fsPath });
    document.dispose();
    document.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      "setContext",
      "openDocumentCount",
      0,
    );
    await expect(document.load()).rejects.toThrow("closed");
  });
  it("allows retrying a failed load", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("bad file"))
      .mockResolvedValue({});
    vi.spyOn(Sharkd.prototype, "getClient").mockResolvedValue({
      request,
    } as unknown as Awaited<ReturnType<Sharkd["getClient"]>>);
    const document = new PcapDocument(vscode.Uri.file("capture.pcap"));
    await expect(document.load()).rejects.toThrow("bad file");
    await expect(document.load()).resolves.toBeDefined();
    document.dispose();
  });
});

describe("selection ordering", () => {
  it("discards out of order responses and requests from inactive or closed editors", () => {
    const selection = new FrameSelection();
    const firstEditor = {};
    const secondEditor = {};
    const old = selection.begin(firstEditor);
    const current = selection.begin(firstEditor);
    expect(selection.commit(firstEditor, current, { bytes: "new" })).toBe(true);
    expect(selection.commit(firstEditor, old, { bytes: "old" })).toBe(false);
    selection.activate(secondEditor, { bytes: "other" });
    expect(selection.commit(firstEditor, current, { bytes: "stale" })).toBe(
      false,
    );
    selection.clear(firstEditor);
    expect(selection.frame?.bytes).toBe("other");
    const pending = selection.begin(secondEditor);
    selection.clear(secondEditor);
    expect(selection.commit(secondEditor, pending, {})).toBe(false);
    expect(selection.frame).toBeUndefined();
    selection.dispose();
  });
});

describe("protocol tree and hex data", () => {
  it("shows the native tree only when protocol fields exist", () => {
    const selection = new FrameSelection();
    const subscriptions: vscode.Disposable[] = [];
    new FrameTreeProvider(
      { subscriptions } as vscode.ExtensionContext,
      selection,
    );
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      "setContext",
      "crumbs.hasProtocolTree",
      false,
    );
    const owner = {};
    selection.commit(owner, selection.begin(owner), { tree: [] });
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      "setContext",
      "crumbs.hasProtocolTree",
      false,
    );
    selection.commit(owner, selection.begin(owner), {
      tree: [{ l: "Ethernet" }],
    });
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      "setContext",
      "crumbs.hasProtocolTree",
      true,
    );
    selection.clear(owner);
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      "setContext",
      "crumbs.hasProtocolTree",
      false,
    );
    for (const disposable of subscriptions) {
      disposable.dispose();
    }
    selection.dispose();
  });
  const nodes: TreeNode[] = [
    {
      l: "parent",
      h: [0, 8],
      n: [
        { l: "leaf", h: [0, 8] },
        { l: "generated", h: [0, 8], g: true },
        { l: "reassembled", h: [2, 3], ds: 1 },
        { l: "empty", n: [] },
      ],
    },
  ];
  it("reuses children and resolves the deepest real field", () => {
    const tree = new FrameTreeDataProvider();
    tree.setRootNodes(nodes);
    const parent = tree.getChildren()[0];
    expect(tree.getChildren(parent)).toBe(tree.getChildren(parent));
    const leaf = tree.getChildren(parent)[0];
    expect(tree.getTreeItemAtRange([0, 8])).toBe(leaf);
    expect(tree.getParent(leaf)).toBe(parent);
    expect(tree.getTreeItemAtRange([2, 3])).toBeUndefined();
    expect(tree.getChildren(parent)[3].collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.None,
    );
    tree.setRootNodes([]);
    expect(tree.getTreeItemAtRange([0, 8])).toBeUndefined();
    tree.dispose();
  });
  it("deduplicates ranges, excludes generated and alternate-source offsets, supports missing trees", () => {
    expect(getHexFrame({ bytes: "AA==", tree: nodes })).toEqual({
      bytes: "AA==",
      byteRanges: [[0, 8]],
    });
    expect(getHexFrame({ bytes: "" })).toEqual({ bytes: "", byteRanges: [] });
    expect(getHexFrame()).toBeNull();
  });
});

describe("frame columns", () => {
  const info = { columns: [{ format: "%m", name: "Number" }] } as InfoResponse;
  it("resolves built-in and custom columns including negative occurrences", () => {
    expect(
      getColumnFields(
        { number: "%m", port: "tcp.port", last: "tcp.port:-1" },
        info,
      ),
    ).toEqual({ column0: 0, column1: "tcp.port:0", column2: "tcp.port:-1" });
  });
  it("rejects invalid column formats instead of sending -1 or default columns", () => {
    expect(() => getColumnFields({ number: "%missing" }, info)).toThrow(
      "Unknown",
    );
    expect(() => getColumnFields({}, info)).toThrow("at least one");
    expect(() => getColumnFields({ number: "" }, info)).toThrow("nonempty");
  });
  it("preserves frame IDs, numeric precision, leading zeros, and missing colors", () => {
    expect(
      toGridRow({ num: 42, c: ["001", "0.000000", "9007199254740993"] }, true),
    ).toEqual({
      id: 42,
      values: ["001", "0.000000", "9007199254740993"],
      background: undefined,
      foreground: undefined,
    });
    expect(
      toGridRow({ num: 1, c: [], bg: "ff0000", fg: "invalid" }, true)
        .background,
    ).toBe("#ff0000");
    expect(
      toGridRow({ num: 1, c: [], bg: "ff0000" }, false).background,
    ).toBeUndefined();
  });
});
