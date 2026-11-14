import * as vscode from "vscode";
import { FrameTreeDataProvider, FrameTreeItem } from "./frameTreeDataProvider";
import FrameList from "./frameList";
import { filterOperations } from "./filterSyntax";
import type { FrameSelection } from "./frameSelection";
import type { ByteRange, FrameResponse } from "./types/sharkd";

export default class FrameTreeProvider {
  constructor(context: vscode.ExtensionContext, selection: FrameSelection) {
    const data = new FrameTreeDataProvider();
    const tree = vscode.window.createTreeView("crumbsFrameTree", {
      treeDataProvider: data,
      showCollapseAll: true,
      canSelectMany: false,
    });
    let visibility: Thenable<unknown>;
    const update = (frame?: FrameResponse) => {
      data.setRootNodes(frame?.tree ?? []);
      visibility = vscode.commands.executeCommand(
        "setContext",
        "crumbs.hasProtocolTree",
        (frame?.tree?.length ?? 0) > 0,
      );
    };
    update(selection.frame);
    for (const mode of ["apply", "prepare"] as const) {
      for (const operation of filterOperations) {
        context.subscriptions.push(
          vscode.commands.registerCommand(
            `crumbs.filter.${mode}.${operation}`,
            async (item?: FrameTreeItem) => {
              const owner = selection.owner;
              if (
                !(item instanceof FrameTreeItem) ||
                !data.hasItem(item) ||
                !item.node.f ||
                item.node.f === "text" ||
                !(owner instanceof FrameList)
              ) {
                return;
              }
              try {
                await owner.filterFromTree(item.node.f, mode, operation);
              } catch (error) {
                void vscode.window.showErrorMessage(
                  `Couldn’t ${mode} display filter: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            },
          ),
        );
      }
    }
    context.subscriptions.push(
      data,
      tree,
      selection.onDidChange(update),
      tree.onDidChangeSelection((event) => {
        const node = event.selection[0]?.node;
        const range: ByteRange =
          node?.h && !node.ds && !node.g ? node.h : [0, 0];
        void vscode.commands
          .executeCommand("frameHexFocus", range)
          .then(undefined, () => {});
      }),
      vscode.commands.registerCommand(
        "frameTreeReveal",
        async (range?: ByteRange) => {
          const item = range
            ? data.getTreeItemAtRange(range)
            : data.getChildren()[0];
          if (item) {
            // Let the matching native view become visible before revealing a node.
            await visibility;
            await tree.reveal(item, {
              expand: false,
              focus: true,
              select: true,
            });
          }
        },
      ),
    );
  }
}
