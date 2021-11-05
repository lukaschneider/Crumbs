import * as vscode from "vscode"
import { isEqual } from "lodash";

import FrameTreeItem from "./frameTreeItem";

export default class FrameTreeDataProvider implements vscode.TreeDataProvider<FrameTreeItem> {
    private rootTreeItems: FrameTreeItem[]

    constructor() {
        this.rootTreeItems = []
    }

    private _onDidChangeTreeData = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event

    setFrameTreeData(rootNodes: SharkdFrameTreeNode[]) {
        this.rootTreeItems = rootNodes.map((node, index) => new FrameTreeItem(node, index))
        this._onDidChangeTreeData.fire()
    }

    getTreeItem(item: FrameTreeItem) {
        return item
    }

    getChildren(item: FrameTreeItem) {
        if (item) {
            return item.children.map((node, index) => new FrameTreeItem(node, index, item))
        } else {
            return this.getRootTreeItems()
        }
    }

    getParent(item: FrameTreeItem) {
        return item.parent
    }

    getRootTreeItems() {
        return this.rootTreeItems
    }

    getTreeItemAtRange(range: SharkdByteRange) {
        let item: FrameTreeItem

        const findItem = (currentItem: FrameTreeItem) => {
            if(isEqual(currentItem.byteRange, range) && !currentItem.generated) {
                item = currentItem
            } else {
                this.getChildren(currentItem).forEach(childItem => findItem(childItem))
            }
        }
        this.rootTreeItems.forEach(currentItem => findItem(currentItem))

        // @ts-ignore ...
        return item
    }
}