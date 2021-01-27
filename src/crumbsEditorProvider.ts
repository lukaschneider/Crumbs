import * as vscode from "vscode";

import CrumbsDocument from "./crumbsDocument";
import CrumbsEditor from "./crumbsEditor";

export default class CrumbsEditorProvider implements vscode.CustomReadonlyEditorProvider {
    private context: vscode.ExtensionContext;

    static readonly viewType = "crumbs.editor";

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    openCustomDocument(uri: vscode.Uri): CrumbsDocument {
        return new CrumbsDocument(uri);
    }

    resolveCustomEditor(document: CrumbsDocument, webviewPanel: vscode.WebviewPanel): void {
        vscode.window.withProgress(
            { location: vscode.ProgressLocation.Window, title: `Loading ${document.uri.path}` },
            async (progress) => {
                return new Promise<void>(async (resolve, reject) => {
                    webviewPanel.onDidDispose(reject);
                    progress.report({ message: "Importing Packets"});

                    await document.sharkd.loadFile(document.uri.path);
                    progress.report({ increment: 69, message: "Finalizing" });

                    new CrumbsEditor(webviewPanel, document, this.context);
                    resolve();
                });
            },
        );
    }
}
