import * as vscode from "vscode";
import * as pug from "pug";
import { min } from "lodash";

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
                return new Promise(async (resolveProgress) => {
                    webviewPanel.onDidDispose(() => resolveProgress(false));

                    await document.sharkd.loadFile(document.uri);
                    progress.report({ increment: 50 });

                    this.createEditor(document, webviewPanel, progress, resolveProgress);
                });
            },
        );
    }

    private createEditor(
        document: Document,
        webviewPanel: vscode.WebviewPanel,
        progress: vscode.Progress<{ increment: number }>,
        resolveProgress: (value: unknown) => void,
    ) {
        const getPugOptions = () => {
            const getWebviewUri = (relativePath: string) =>
                webviewPanel.webview
                    .asWebviewUri(vscode.Uri.file(this.context.asAbsolutePath(relativePath)))
                    .toString();

            const css = getWebviewUri("src/editor/editor.css");

            const gridCss = getWebviewUri("node_modules/ag-grid-community/dist/styles/ag-grid.min.css");
            const gridTheme = getWebviewUri("node_modules/ag-grid-community/dist/styles/ag-theme-alpine-dark.min.css");

            const script = getWebviewUri("out/editor.js");
            const scriptMap = getWebviewUri("out/editor.js.map");

            return {
                css,
                gridCss,
                gridTheme,
                script,
                scriptMap,
            };
        };

        webviewPanel.webview.options = { enableScripts: true };
        webviewPanel.webview.html = pug.renderFile(
            this.context.asAbsolutePath("src/editor/editor.pug"),
            getPugOptions(),
        );
        webviewPanel.webview.onDidReceiveMessage((message: Message<any>) =>
            this.onMessage(webviewPanel, document, message),
        );

        progress.report({ increment: 40 });

        webviewPanel.webview.onDidReceiveMessage(async (message: Message<any>) => {
            switch (message.type) {
                case "ready":
                    this.postMessage(webviewPanel, "init", {
                        columns: vscode.workspace.getConfiguration("crumbs").get("editor.columns"),
                        columnFrames: await document.sharkd.getFrames(0, 100),
                    });
                    this.provideFrames(webviewPanel, document, 100, 1000, resolveProgress);
            }
        });
    }

    private provideFrames(
        webviewPanel: vscode.WebviewPanel,
        document: Document,
        skip: number,
        limit: number,
        resolveProgress: (value: unknown) => void,
        timeout: number = 1,
    ) {
        document.sharkd.getFrames(skip, limit).then((columnFrames) => {
            if (columnFrames.length != 0) {
                this.postMessage(webviewPanel, "appendFrames", columnFrames);
                timeout = 1;
            } else {
                resolveProgress(true);
            }
            setTimeout(
                () =>
                    this.provideFrames(
                        webviewPanel,
                        document,
                        skip + limit,
                        limit,
                        resolveProgress,
                        min([timeout * 2, 3000]),
                    ),
                timeout,
            );
        });
    }

    private async onMessage(webviewPanel: vscode.WebviewPanel, document: Document, message: Message<any>) {
        switch (message.type) {
            case "error":
                webviewPanel.dispose();
                vscode.window.showErrorMessage(message.body);
                break;
        }
    }

    private postMessage(webviewPanel: vscode.WebviewPanel, type: string, body?: any) {
        const message: Message<any> = { type, body };
        webviewPanel.webview.postMessage(message);
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
