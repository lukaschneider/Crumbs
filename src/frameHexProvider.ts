import * as vscode from "vscode";
import FrameHex from "./frameHex";
import type { FrameSelection } from "./frameSelection";

export default class FrameHexProvider implements vscode.WebviewViewProvider {
  #context: vscode.ExtensionContext;

  constructor(
    context: vscode.ExtensionContext,
    private readonly selection: FrameSelection,
  ) {
    this.#context = context;

    this.#context.subscriptions.push(
      vscode.window.registerWebviewViewProvider("crumbsFrameHex", this, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    new FrameHex(webviewView, this.#context, this.selection);
  }
}
