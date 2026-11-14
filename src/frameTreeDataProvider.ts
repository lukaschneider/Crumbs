import * as vscode from "vscode";
import type { ByteRange, TreeNode } from "./types/sharkd";

export class FrameTreeItem extends vscode.TreeItem {
  readonly children: FrameTreeItem[];
  constructor(
    readonly node: TreeNode,
    index: number,
    readonly parent?: FrameTreeItem,
  ) {
    super(
      node.g ? `[${node.l}]` : node.l,
      node.n?.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.id = `${parent?.id ?? "root"}-${index}`;
    this.contextValue =
      node.f && node.f !== "text" ? "crumbsFilterable" : undefined;
    this.children = (node.n ?? []).map(
      (child, childIndex) => new FrameTreeItem(child, childIndex, this),
    );
    const icons: Record<string, [string, string]> = {
      chat: ["comment-discussion", "terminal.ansiBlue"],
      note: ["note", "terminal.ansiCyan"],
      warning: ["warning", "terminal.ansiYellow"],
      error: ["error", "terminal.ansiRed"],
    };
    const icon = node.s ? icons[node.s.toLowerCase()] : undefined;
    if (icon) {
      this.iconPath = new vscode.ThemeIcon(
        icon[0],
        new vscode.ThemeColor(icon[1]),
      );
    }
  }
}

export class FrameTreeDataProvider
  implements vscode.TreeDataProvider<FrameTreeItem>, vscode.Disposable
{
  #roots: FrameTreeItem[] = [];
  #ranges = new Map<string, FrameTreeItem>();
  #items = new Set<FrameTreeItem>();
  #changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.#changed.event;

  setRootNodes(nodes: TreeNode[]) {
    this.#roots = nodes.map((node, index) => new FrameTreeItem(node, index));
    this.#ranges.clear();
    this.#items.clear();
    const index = (item: FrameTreeItem) => {
      this.#items.add(item);
      const range = item.node.h;
      if (range && range[1] > 0 && !item.node.g && !item.node.ds) {
        this.#ranges.set(range.join(":"), item);
      }
      item.children.forEach(index);
    };
    this.#roots.forEach(index);
    this.#changed.fire();
  }

  getTreeItem(element: FrameTreeItem) {
    return element;
  }
  hasItem(item: FrameTreeItem) {
    return this.#items.has(item);
  }
  getChildren(element?: FrameTreeItem) {
    return element ? element.children : this.#roots;
  }
  getParent(element: FrameTreeItem) {
    return element.parent;
  }
  getTreeItemAtRange(range: ByteRange) {
    return this.#ranges.get(range.join(":"));
  }
  dispose() {
    this.#changed.dispose();
  }
}
