import * as vscode from "vscode"

import Document from "./document"

export default class PacketEditorInstance {
    document: Document
    webviewPanel: vscode.WebviewPanel
    context: vscode.ExtensionContext

    constructor(document: Document, webviewPanel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this.document = document
        this.webviewPanel = webviewPanel
        this.context = context

        webviewPanel.webview.options = {
            enableScripts: true,
        }

        webviewPanel.webview.html = this.generateWebviewHtml()

        webviewPanel.webview.onDidReceiveMessage(this.onMessage.bind(this))
    }

    async reset() {
        const columns: ConfigColumn[] = vscode.workspace.getConfiguration("crumbs").get("packetEditor.columns") || []
        const message: PacketEditorInstanceResetMessage = { type: "packetEditorInstanceReset", columns: columns }
        this.webviewPanel.webview.postMessage(message)

        await this.getFrames(columns)
    }

    async getFrames(columns: ConfigColumn[], skip: number = 0, limit: number = 5000) {
        const frames = await this.document.getFrames(columns, skip, limit)

        if (frames.length !== 0) {
            const message: PacketEditorInstanceFramesMessage = { type: "packetEditorInstanceFrames", frames: frames }
            this.webviewPanel.webview.postMessage(message)

            this.getFrames(
                columns,
                skip + frames.length,
                vscode.workspace.getConfiguration("crumbs").get("packetEditor.chunkSize"))
        }
    }

    private onMessage(message: PacketEditorWebviewMessage) {
        switch (message.type) {
            case "packetEditorWebviewReady":
                this.reset()
        }
    }

    private generateWebviewHtml(): string {
        const scriptUri = this.webviewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "out", "webview.js")
        )

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8"/>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script src="${scriptUri}"></script>
                </head>
                <body>
                    <div id="root"/>
                </body>
            </html>
        `
    }
}
