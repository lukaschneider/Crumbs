import * as vscode from "vscode";

import CrumbsEditor from "./crumbsEditor";
import CrumbsFrameTreeItem from "./crumbsFrameTreeItem";

export default class CrumbsFrameTreeProvider implements vscode.TreeDataProvider<CrumbsFrameTreeItem> {
    private rootTreeItems?: CrumbsFrameTreeItem[];

    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {
        CrumbsEditor.onSetFrameTree.event((frameTree: SharkdTreeNode[]) => {
            this.rootTreeItems = frameTree.map((node, index) => new CrumbsFrameTreeItem(node, index));
            this._onDidChangeTreeData.fire();
        });
    }

    getTreeItem(item: CrumbsFrameTreeItem) {
        return item;
    }

    getChildren(item?: CrumbsFrameTreeItem): CrumbsFrameTreeItem[] {
        if (item) {
            return item.nodes.map((node, index) => new CrumbsFrameTreeItem(node, index, item));
        } else {
            return this.rootTreeItems || [];
        }
    }

    getParent(item: CrumbsFrameTreeItem): CrumbsFrameTreeItem | undefined {
        return item.parent;
    }

    getRootTreeItems(): CrumbsFrameTreeItem[] {
        return this.rootTreeItems || [];
    }
}
