import * as vscode from "vscode"
import { Mutex } from "async-mutex"

import Document from "./document"

export default class FrameListInstance {
    private cancelReset: boolean
    private context: vscode.ExtensionContext
    private document: Document
    private resetMutex: Mutex
    private webviewPanel: vscode.WebviewPanel

    constructor(document: Document, webviewPanel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this.cancelReset = false
        this.context = context
        this.document = document
        this.resetMutex = new Mutex()
        this.webviewPanel = webviewPanel

        webviewPanel.webview.options = {
            enableScripts: true,
        }

        webviewPanel.webview.html = this.generateWebviewHtml()

        webviewPanel.webview.onDidReceiveMessage(this.onMessage.bind(this))

        vscode.workspace.onDidChangeConfiguration(this.onConfigure.bind(this))
    }

    async reset() {
        await this.resetMutex.runExclusive(async () => {
            this.cancelReset = false
            const columns: ConfigColumn[] = vscode.workspace.getConfiguration("crumbs").get("frameList.columns") || []
            const colorCoding: boolean = vscode.workspace.getConfiguration("crumbs").get("frameList.colorCoding") || false
            const message: FrameListInstanceResetMessage = { type: "frameListInstanceReset", columns: columns, colorCoding: colorCoding }
            this.webviewPanel.webview.postMessage(message)

            await this.getFrames(columns)
        })
    }

    async getFrames(columns: ConfigColumn[], skip: number = 0, limit: number = 5000) {
        const frames = await this.document.getFrames(columns, skip, limit)

        if (frames.length !== 0 && !this.cancelReset) {
            const message: FrameListInstanceFramesMessage = { type: "frameListInstanceFrames", frames: frames }
            this.webviewPanel.webview.postMessage(message)

            await this.getFrames(
                columns,
                skip + frames.length,
                vscode.workspace.getConfiguration("crumbs").get("frameList.chunkSize"))
        }
    }

    private onMessage(message: FrameListWebviewMessage) {
        switch (message.type) {
            case "frameListWebviewReady":
                this.cancelReset = true
                this.resetMutex.cancel()
                this.reset()
        }
    }

    private onConfigure(event: vscode.ConfigurationChangeEvent) {
        if (event.affectsConfiguration("crumbs")) {
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
