import * as vscode from "vscode"

export default class FrameTreeItem extends vscode.TreeItem {
    parent?: FrameTreeItem
    children: SharkdFrameTreeNode[]

    constructor(node: SharkdFrameTreeNode, index: number, parent?: FrameTreeItem) {
        super(
            node.g ? `[${node.l}]` : node.l, // Label
            node.n ? // Collapsible State
                vscode.TreeItemCollapsibleState.Collapsed :
                vscode.TreeItemCollapsibleState.None
        )

        this.id = `${parent?.id}-${node.e}-${index}`
        this.parent = parent
        this.children = node.n || []
    }
}