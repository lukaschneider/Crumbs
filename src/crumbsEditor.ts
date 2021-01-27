import * as vscode from "vscode";
import * as pug from "pug";
import { min } from "lodash";

import CrumbsDocument from "./crumbsDocument";

export default class CrumbsEditor {
    private context: vscode.ExtensionContext;
    private document: CrumbsDocument;
    private webviewPanel: vscode.WebviewPanel;

    constructor(webviewPanel: vscode.WebviewPanel, document: CrumbsDocument, context: vscode.ExtensionContext) {
        this.webviewPanel = webviewPanel;
        this.document = document;
        this.context = context;

        const getAbsoluteWebviewUri = (relativePath: string) =>
            webviewPanel.webview.asWebviewUri(vscode.Uri.file(this.context.asAbsolutePath(relativePath))).toString();

        webviewPanel.webview.options = { enableScripts: true };

        webviewPanel.webview.html = pug.renderFile(this.context.asAbsolutePath("media/editor.pug"), {
            css: getAbsoluteWebviewUri("media/editor.css"),
            gridCss: getAbsoluteWebviewUri("node_modules/ag-grid-community/dist/styles/ag-grid.min.css"),
            gridTheme: getAbsoluteWebviewUri("node_modules/ag-grid-community/dist/styles/ag-theme-alpine-dark.min.css"),
            script: getAbsoluteWebviewUri("dist/editor.js"),
        });

        webviewPanel.webview.onDidReceiveMessage(this.onMessage.bind(this));
    }

    private async onMessage(message: WebviewMessage) {
        switch (message.type) {
            case "ready":
                this.postMessage<EditorSetColumnsMessage>({
                    type: "setColumns",
                    body: vscode.workspace.getConfiguration("crumbs").get("editor.columns"),
                });
                this.postMessage<EditorSetRowsMessage>({
                    type: "setRows",
                    body: await this.document.sharkd.getRows(0, 100),
                });
                this.rowLoop(100, 1000);
        }
    }

    private async rowLoop(skip: number, limit: number, timeout: number = 1) {
        const rows = await this.document.sharkd.getRows(skip, limit);

        timeout = <number>min([timeout * 2, 4096]);

        if (rows.length !== 0) {
            this.postMessage<EditorAppendRowsMessage>({ type: "appendRows", body: rows });
            timeout = 1;
            skip += rows.length;
        }

        setTimeout(() => this.rowLoop(skip, limit, timeout), timeout);
    }

    postMessage<MessageType>(message: MessageType) {
        this.webviewPanel.webview.postMessage(message);
    }
}
