import * as vscode from "vscode";
import FrameHexProvider from "./frameHexProvider";
import FrameListProvider from "./frameListProvider";
import FrameTreeProvider from "./frameTreeProvider";
import FrameTreeWelcomeProvider from "./frameTreeWelcomeProvider";
import { FrameSelection } from "./frameSelection";

export function activate(context: vscode.ExtensionContext) {
  const selection = new FrameSelection();
  const output = vscode.window.createOutputChannel("Crumbs (sharkd)");
  context.subscriptions.push(selection, output);
  context.subscriptions.push(
    vscode.commands.registerCommand("crumbs.showOutput", () => {
      output.show(true);
    }),
  );
  new FrameListProvider(context, selection, (message) =>
    output.appendLine(message),
  );
  new FrameHexProvider(context, selection);
  new FrameTreeProvider(context, selection);
  new FrameTreeWelcomeProvider(context, selection);
}

export function deactivate() {}
