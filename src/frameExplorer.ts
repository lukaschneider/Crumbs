import * as vscode from "vscode"
import FrameHexProvider from "./frameHexProvider"
import FrameTreeDataProvider from "./frameTreeDataProvider"
import FrameTreeItem from "./frameTreeItem"

export default class FrameExplorer {
    frameHexProvider: FrameHexProvider
    frameTreeDataProvider: FrameTreeDataProvider
    frameTreeInstance: vscode.TreeView<FrameTreeItem>

    constructor(context: vscode.ExtensionContext) {
        // FrameTree
        this.frameTreeDataProvider = new FrameTreeDataProvider()
        this.frameTreeInstance = vscode.window.createTreeView("crumbs.frameTree", {
            treeDataProvider: this.frameTreeDataProvider,
            showCollapseAll: true,
            canSelectMany: false,
        })
        this.frameTreeInstance.onDidChangeSelection(this.frameTreeInstanceSelectionChanged.bind(this))

        // FrameHex
        this.frameHexProvider = new FrameHexProvider(context, this.focusFrameTreeItemAtRange.bind(this))
    }

    async reveal() {
        await this.frameTreeInstance.reveal(
            this.frameTreeDataProvider.getRootTreeItems()[0],
            { expand: false, focus: false, select: false })
    }

    private focusFrameTreeItemAtRange(range: SharkdByteRange) {
        const treeItem = this.frameTreeDataProvider.getTreeItemAtRange(range)

        if(treeItem) {
            this.frameTreeInstance.reveal(treeItem, { expand: false, focus: true, select: true })
        }
    }

    private frameTreeInstanceSelectionChanged(event: vscode.TreeViewSelectionChangeEvent<FrameTreeItem>) {
        if(event.selection.length == 0 || event.selection[0].byteRange == undefined) {
            return
        }

        this.frameHexProvider.select(event.selection[0].byteRange)
    }
}