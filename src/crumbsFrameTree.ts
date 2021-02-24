import * as vscode from "vscode";

import CrumbsEditor from "./crumbsEditor";
import CrumbsFrameTreeItem from "./crumbsFrameTreeItem";
import CrumbsFrameTreeProvider from "./crumbsFrameTreeProvider";

export default class CrumbsFrameTree {
    private crumbsFrameTree: vscode.TreeView<CrumbsFrameTreeItem>;
    private crumbsFrameTreeProvider: CrumbsFrameTreeProvider;

    constructor() {
        this.crumbsFrameTreeProvider = new CrumbsFrameTreeProvider();

        this.crumbsFrameTree = vscode.window.createTreeView("crumbsFrameTree", {
            treeDataProvider: this.crumbsFrameTreeProvider,
        });

        CrumbsEditor.onFocusFrameTree.event(async (callback) => {
            await this.reveal();
            callback();
        });
    }

    private async reveal() {
        const rootTreeItems = this.crumbsFrameTreeProvider.getRootTreeItems();
        if (rootTreeItems) {
            await this.crumbsFrameTree.reveal(rootTreeItems[0], { expand: false, focus: false, select: false });
        }
    }
}
