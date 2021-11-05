import * as vscode from "vscode"

export default class FrameTreeItem extends vscode.TreeItem {
    parent?: FrameTreeItem
    byteRange?: SharkdByteRange
    children: SharkdFrameTreeNode[]
    generated?: boolean

    constructor(node: SharkdFrameTreeNode, index: number, parent?: FrameTreeItem) {
        super(
            node.g ? `[${node.l}]` : node.l, // Label
            node.n ? // Collapsible State
                vscode.TreeItemCollapsibleState.Collapsed :
                vscode.TreeItemCollapsibleState.None
        )

        this.id = `${parent?.id}-${node.e}-${index}`
        this.parent = parent
        this.byteRange = node.h
        this.children = node.n || []
        this.generated = node.g

        switch(node.s) {
            case "Chat":
                this.iconPath = new vscode.ThemeIcon("comment-discussion", new vscode.ThemeColor("terminal.ansiBlue"))
                break
            case "Note":
                this.iconPath = new vscode.ThemeIcon("note", new vscode.ThemeColor("terminal.ansiCyan"))
                break
            case "Warning":
                this.iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("terminal.ansiYellow"))
                break
            case "Error":
                this.iconPath = new vscode.ThemeIcon("error", new vscode.ThemeColor("terminal.ansiRed"))
                break
        }
    }
}
