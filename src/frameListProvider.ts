import * as vscode from "vscode";
import FrameList from "./frameList";
import PcapDocument from "./pcapDocument";
import type { FrameSelection } from "./frameSelection";
import { FilterHistory } from "./filterHistory";

export default class FrameListProvider
  implements vscode.CustomReadonlyEditorProvider
{
  #context: vscode.ExtensionContext;
  #documents = new Set<PcapDocument>();
  #history: FilterHistory;

  constructor(
    context: vscode.ExtensionContext,
    private readonly selection: FrameSelection,
    private readonly log: (message: string) => void,
  ) {
    this.#context = context;
    this.#history = new FilterHistory(context.globalState);

    this.#context.subscriptions.push(
      this.#history,
      new vscode.Disposable(() => {
        for (const document of this.#documents) {
          document.dispose();
        }
      }),
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
    const document = new PcapDocument(uri, this.log, () => {
      this.#documents.delete(document);
    });
    this.#documents.add(document);
    return document;
  }

  resolveCustomEditor(
    document: PcapDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): void {
    new FrameList(
      document,
      webviewPanel,
      this.#context,
      this.selection,
      this.#history,
    );
  }
}
