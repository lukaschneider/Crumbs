import * as vscode from "vscode";
import FrameList from "./frameList";
import PcapDocument from "./pcapDocument";

export default class FrameListProvider
  implements vscode.CustomReadonlyEditorProvider
{
  #context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.#context = context;

    this.#context.subscriptions.push(
      vscode.window.registerCustomEditorProvider("crumbsFrameList", this, {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }),
    );
  }

  openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): PcapDocument {
    return new PcapDocument(uri);
  }

  resolveCustomEditor(
    document: PcapDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): void {
    new FrameList(document, webviewPanel, this.#context);
  }
}
