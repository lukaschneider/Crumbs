import * as vscode from "vscode";
import CrumbsEditor from "./crumbsEditor";

export default class CrumbsFrameTreeProvider implements vscode.TreeDataProvider<CrumbsFrameTreeItem> {
    private frameTree: SharkdTreeNode[];

    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {
        this.frameTree = [];

        CrumbsEditor.onSetFrameTree.event((frameTree: SharkdTreeNode[]) => {
            this.frameTree = frameTree;
            this._onDidChangeTreeData.fire();
        });

        CrumbsEditor.onFocusFrameTree.event(() => {
            console.debug("TreeView Focus not implemented."); // TODO: Implement
        });
    }

    getTreeItem(item: CrumbsFrameTreeItem) {
        return item;
    }

    getChildren(item?: CrumbsFrameTreeItem): CrumbsFrameTreeItem[] {
        if (item) {
            return item.nodes.map((node, index) => new CrumbsFrameTreeItem(node, index, item.id));
        } else {
            return this.frameTree.map((node, index) => new CrumbsFrameTreeItem(node, index));
        }
    }
}

export class CrumbsFrameTreeItem extends vscode.TreeItem {
    nodes: SharkdTreeNode[];

    constructor(node: SharkdTreeNode, index: number, parentId: string = "root") {
        super(
            node.g ? `[${node.l}]` : node.l,
            node.n ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        );
        this.id = `${parentId}.${node.e}.${index}`;
        this.nodes = node.n || [];
    }
}
