import _, { isEqual } from "lodash";
import * as vscode from "vscode";
import type { ByteRange, TreeNode } from "./types/sharkd";

export class FrameTreeItem extends vscode.TreeItem {
  parent?: FrameTreeItem;
  children: TreeNode[];
  node: TreeNode;

  constructor(node: TreeNode, index: number, parent?: FrameTreeItem) {
    super(
      node.g ? `[${node.l}]` : node.l,
      node.n
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.id = `${parent?.id || "root"}-${node.e}-${index}`;
    this.parent = parent;
    this.children = node.n;
    this.node = node;

    const iconMap: Record<string, { icon: string; color: string }> = {
      chat: { icon: "comment-discussion", color: "terminal.ansiBlue" },
      note: { icon: "note", color: "terminal.ansiCyan" },
      warning: { icon: "warning", color: "terminal.ansiYellow" },
      error: { icon: "error", color: "terminal.ansiRed" },
    };

    const iconConfig = node.s ? iconMap[node.s.toLowerCase()] : undefined;
    if (iconConfig) {
      this.iconPath = new vscode.ThemeIcon(
        iconConfig.icon,
        new vscode.ThemeColor(iconConfig.color),
      );
    }
  }
}

export class FrameTreeDataProvider
  implements vscode.TreeDataProvider<FrameTreeItem>
{
  #rootTreeItems: FrameTreeItem[] = [];
  #onDidChangeTreeData: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();

  readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  setRootNodes(nodes: TreeNode[]) {
    const treeItems = nodes.map(
      (node, index) => new FrameTreeItem(node, index),
    );

    if (_.isEqual(treeItems, this.#rootTreeItems)) {
      return;
    }

    this.#rootTreeItems = treeItems;
    this.#onDidChangeTreeData.fire();
  }

  getTreeItem(element: FrameTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FrameTreeItem | undefined): FrameTreeItem[] {
    if (element) {
      return !element.children
        ? []
        : element.children.map(
            (node, index) => new FrameTreeItem(node, index, element),
          );
    }

    return this.#rootTreeItems;
  }

  getParent?(element: FrameTreeItem): FrameTreeItem | undefined {
    return element.parent;
  }

  resolveTreeItem?(
    item: vscode.TreeItem,
    _element: FrameTreeItem,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.TreeItem> {
    return item;
  }

  getTreeItemAtRange(range: ByteRange): FrameTreeItem | undefined {
    let item: FrameTreeItem | undefined;

    const findItem = (currentItem: FrameTreeItem) => {
      if (isEqual(currentItem.node.h, range) && !currentItem.node.g) {
        item = currentItem;
      } else {
        this.getChildren(currentItem).forEach((childItem) => {
          findItem(childItem);
        });
      }
    };
    this.#rootTreeItems.forEach((currentItem) => {
      findItem(currentItem);
    });

    return item;
  }
}
