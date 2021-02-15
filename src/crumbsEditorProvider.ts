import * as vscode from "vscode";

import CrumbsDocument from "./crumbsDocument";
import CrumbsEditor from "./crumbsEditor";

export default class CrumbsEditorProvider implements vscode.CustomReadonlyEditorProvider {
    private context: vscode.ExtensionContext;
    private activeEditors: number;

    static readonly viewType = "crumbs.editor";

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.activeEditors = 0;

        vscode.window.registerCustomEditorProvider(CrumbsEditorProvider.viewType, this, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: true,
        });
    }

    openCustomDocument(uri: vscode.Uri): CrumbsDocument {
        return new CrumbsDocument(uri);
    }

    async resolveCustomEditor(document: CrumbsDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Window, title: `Loading ${document.uri.path}` },
            async (progress) => {
                return new Promise<void>(async (resolve, reject) => {
                    webviewPanel.onDidDispose(reject);
                    progress.report({ message: "Importing Packets" });

                    await document.sharkd.loadFile(document.uri.path);
                    progress.report({ increment: 69, message: "Finalizing" });

                    new CrumbsEditor(webviewPanel, document, this.context);
                    this.activeEditors++;
                    vscode.commands.executeCommand("setContext", "crumbs:activeEditors", this.activeEditors);

                    webviewPanel.onDidDispose(() => {
                        this.activeEditors--;
                        vscode.commands.executeCommand("setContext", "crumbs:activeEditors", this.activeEditors);
                    });

                    resolve();
                });
            },
        );
    }
}
