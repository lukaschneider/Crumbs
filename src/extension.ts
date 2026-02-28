import type * as vscode from "vscode";
import FrameHexProvider from "./frameHexProvider";
import FrameListProvider from "./frameListProvider";
import FrameTreeProvider from "./frameTreeProvider";

export function activate(context: vscode.ExtensionContext) {
  new FrameListProvider(context);
  new FrameHexProvider(context);
  new FrameTreeProvider(context);
}

export function deactivate() {}
