import * as vscode from "vscode";
import { Sharkd } from "./sharkd";

let openDocumentCount = 0;

export default class PcapDocument
  extends vscode.Disposable
  implements vscode.CustomDocument
{
  uri: vscode.Uri;
  sharkd: Sharkd;

  constructor(uri: vscode.Uri) {
    super(() => this.dispose());
    this.uri = uri;

    const config = vscode.workspace.getConfiguration("crumbs");
    this.sharkd = new Sharkd(
      config.get<string>("profile"),
      config.get<string>("sharkd"),
    );

    openDocumentCount++;
    this.#updateOpenDocumentCount();
  }

  dispose() {
    openDocumentCount--;
    this.#updateOpenDocumentCount();
    this.sharkd.stop();
  }

  #updateOpenDocumentCount() {
    vscode.commands.executeCommand(
      "setContext",
      "openDocumentCount",
      openDocumentCount,
    );
  }
}
