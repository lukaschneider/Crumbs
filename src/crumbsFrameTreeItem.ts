import * as vscode from "vscode";

export default class CrumbsFrameTreeItem extends vscode.TreeItem {
    parent?: CrumbsFrameTreeItem;
    nodes: SharkdTreeNode[];

    constructor(node: SharkdTreeNode, index: number, parent?: CrumbsFrameTreeItem) {
        super(
            node.g ? `[${node.l}]` : node.l,
            node.n ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        );
        this.id = `${parent?.id}.${node.e}.${index}`;
        this.parent = parent;
        this.nodes = node.n || [];
    }
}
