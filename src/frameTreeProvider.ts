import * as vscode from "vscode";
import {
  FrameTreeDataProvider,
  type FrameTreeItem,
} from "./frameTreeDataProvider";
import type { ByteRange, FrameResponse } from "./types/sharkd";

export default class FrameTreeProvider {
  #context: vscode.ExtensionContext;
  #treeDataProvider: FrameTreeDataProvider;
  #treeView: vscode.TreeView<FrameTreeItem>;

  constructor(context: vscode.ExtensionContext) {
    this.#context = context;
    this.#treeDataProvider = new FrameTreeDataProvider();

    // Setup tree
    this.#treeView = vscode.window.createTreeView("crumbsFrameTree", {
      treeDataProvider: this.#treeDataProvider,
      showCollapseAll: true,
      canSelectMany: false,
    });

    this.#treeView.onDidChangeSelection(
      async (event: vscode.TreeViewSelectionChangeEvent<FrameTreeItem>) => {
        if (event.selection.length === 0) {
          return;
        }

        await vscode.commands.executeCommand(
          "frameHexFocus",
          event.selection[0].node.h,
        );
      },
    );

    this.#context.subscriptions.push(this.#treeView);

    // Setup command handlers
    this.#context.subscriptions.push(
      vscode.commands.registerCommand("frameTreeUpdateFrame", () => {
        const frame =
          this.#context.workspaceState.get<FrameResponse>("currentFrame");
        if (!frame || !frame.tree) {
          return;
        }

        this.#treeDataProvider.setRootNodes(frame.tree);
      }),
    );

    this.#context.subscriptions.push(
      vscode.commands.registerCommand(
        "frameTreeReveal",
        async (byteRange?: ByteRange) => {
          let item: FrameTreeItem | undefined;

          if (!byteRange) {
            const rootItems = this.#treeDataProvider.getChildren();

            if (!rootItems) {
              return;
            }

            item = rootItems[0];
          } else {
            item = this.#treeDataProvider.getTreeItemAtRange(byteRange);
          }

          if (!item) {
            return;
          }
          await this.#treeView.reveal(item, {
            expand: false,
            focus: true,
            select: true,
          });
        },
      ),
    );
  }
}
