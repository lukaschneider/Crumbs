import * as vscode from "vscode";
import FrameHex from "./frameHex";

export default class FrameHexProvider implements vscode.WebviewViewProvider {
  #context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
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
    new FrameHex(webviewView, this.#context);
  }
}
