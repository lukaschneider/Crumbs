import * as vscode from "vscode";
import * as path from "path";
import * as pug from "pug";
import { min } from "lodash";

import CrumbsDocument from "./crumbsDocument";

export default class CrumbsEditor {
    private context: vscode.ExtensionContext;
    private document: CrumbsDocument;
    private webviewPanel: vscode.WebviewPanel;

    static readonly onFocusFrameTree = new vscode.EventEmitter<Function>();
    static readonly onSetFrameTree = new vscode.EventEmitter<SharkdTreeNode[]>();

    constructor(webviewPanel: vscode.WebviewPanel, document: CrumbsDocument, context: vscode.ExtensionContext) {
        this.webviewPanel = webviewPanel;
        this.document = document;
        this.context = context;

        const getAbsoluteWebviewUri = (...relativePath: string[]) =>
            webviewPanel.webview
                .asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, ...relativePath)))
                .toString();

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(this.context.extensionPath)],
        };

        webviewPanel.webview.html = pug.renderFile(this.context.asAbsolutePath("webviews/editor.pug"), {
            css: getAbsoluteWebviewUri("webviews", "editor.css"),
            gridCss: getAbsoluteWebviewUri("dist", "ag-grid.min.css"),
            gridTheme: getAbsoluteWebviewUri("dist", "ag-theme-alpine.min.css"),
            script: getAbsoluteWebviewUri("dist", "editor.js"),
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
                    rows: await this.document.sharkd.getRows(0, 100),
                    colored: vscode.workspace.getConfiguration("crumbs").get("editor.coloredRows"),
                });
                this.rowLoop(100, 1000);
                break;
            case "setFrameTree":
                const frame = await this.document.sharkd.getFrame((message as WebviewSetFrameTreeMessage).frameNumber);
                CrumbsEditor.onSetFrameTree.fire(frame.tree);
                break;
            case "focusFrameTree":
                CrumbsEditor.onFocusFrameTree.fire(() => {
                    this.postMessage<EditorEnsureRowVisibleMessage>({
                        type: "ensureRowVisible",
                        rowId: (message as WebviewfocusFrameTreeMessage).rowId,
                    });
                });
                break;
        }
    }

    private async rowLoop(skip: number, limit: number = 1000, timeout: number = 1) {
        const rows = await this.document.sharkd.getRows(skip, limit);

        timeout = <number>min([timeout * 2, 4096]);

        if (rows.length !== 0) {
            this.postMessage<EditorAppendRowsMessage>({ type: "appendRows", rows });
            timeout = 1;
            skip += rows.length;
        }

        setTimeout(
            () => this.rowLoop(skip, vscode.workspace.getConfiguration("crumbs").get("editor.chunkSize"), timeout),
            timeout,
        );
    }

    postMessage<MessageType>(message: MessageType) {
        this.webviewPanel.webview.postMessage(message);
    }
}
