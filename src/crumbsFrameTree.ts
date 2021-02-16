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

        CrumbsEditor.onFocusFrameTree.event(() => {
            this.reveal();
        });
    }

    private reveal() {
        const rootTreeItems = this.crumbsFrameTreeProvider.getRootTreeItems();
        if (rootTreeItems) {
            this.crumbsFrameTree.reveal(rootTreeItems[0], { expand: false, focus: false, select: false });
        }
    }
}
