import * as vscode from "vscode"
import FrameTreeDataProvider from "./frameTreeDataProvider"
import FrameTreeItem from "./frameTreeItem"

export default class FrameTree {
    frameTreeDataProvider: FrameTreeDataProvider
    frameTreeInstance: vscode.TreeView<FrameTreeItem>

    constructor() {
        this.frameTreeDataProvider = new FrameTreeDataProvider()

        this.frameTreeInstance = vscode.window.createTreeView("crumbs.frameTree", {
            treeDataProvider: this.frameTreeDataProvider,
            showCollapseAll: true
        })
    }

    async reveal() {
        await this.frameTreeInstance.reveal(
            this.frameTreeDataProvider.getRootTreeItems()[0],
            { expand: false, focus: true, select: false })
    }
}