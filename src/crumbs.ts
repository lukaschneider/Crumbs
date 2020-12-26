import * as vscode from "vscode";
import * as pug from "pug";

import { Sharkd } from "./sharkd";

export class Provider implements vscode.CustomReadonlyEditorProvider<Document> {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    openCustomDocument(uri: vscode.Uri): Document | Thenable<Document> {
        return new Document(uri);
    }

    resolveCustomEditor(document: Document, webviewPanel: vscode.WebviewPanel): void | Thenable<void> {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: `Loading ${document.uri.path}`,
            },
            async (progress) => {
                return new Promise(async (resolve) => {
                    webviewPanel.onDidDispose(() => {
                        resolve(false);
                    });

                    await document.sharkd.loadFile(document.uri);
                    progress.report({ increment: 50 });

                    const data = await document.sharkd.analyse();
                    progress.report({ increment: 40 });

                    const html = pug.renderFile(this.context.asAbsolutePath("src/views/base.pug"), {
                        analyse: JSON.stringify(data),
                    });
                    webviewPanel.webview.html = html;

                    progress.report({ increment: 10 });
                    resolve(true);
                });
            },
        );
    }

    static readonly viewType = "crumbs.editor";
}

export class Document extends vscode.Disposable implements vscode.CustomDocument {
    uri: vscode.Uri;
    sharkd: Sharkd;

    constructor(uri: vscode.Uri) {
        super(() => {}); // callOnDispose?
        this.uri = uri;
        this.sharkd = new Sharkd();
    }
}
