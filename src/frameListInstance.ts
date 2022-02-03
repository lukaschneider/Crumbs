import * as vscode from "vscode"
import { Mutex } from "async-mutex"

import Context from "./context"
import Document from "./document"
import FrameExplorer from "./frameExplorer"

export default class FrameListInstance {
    private stopReset: boolean
    private context: vscode.ExtensionContext
    private document: Document
    private resetMutex: Mutex
    private webviewPanel: vscode.WebviewPanel
    private frameExplorer: FrameExplorer

    displayFilter: string

    constructor(document: Document, webviewPanel: vscode.WebviewPanel, context: vscode.ExtensionContext, frameExplorer: FrameExplorer) {
        this.stopReset = false
        this.context = context
        this.document = document
        this.resetMutex = new Mutex()
        this.webviewPanel = webviewPanel
        this.frameExplorer = frameExplorer
        this.displayFilter = ""

        Context.setActiveDocumentPath(this.context, this.document.uri.path)
        Context.setActiveFrameListInstance(this.context, this)

        vscode.workspace.onDidChangeConfiguration(this.onConfigure.bind(this))

        webviewPanel.onDidChangeViewState(this.onDidChangeViewState.bind(this))
        webviewPanel.onDidDispose(this.onDidDispose.bind(this))

        webviewPanel.webview.options = { enableScripts: true }
        webviewPanel.webview.html = this.generateWebviewHtml()
        webviewPanel.webview.onDidReceiveMessage(this.onMessage.bind(this))
    }

    async checkFilter(filter: string = "") {
        return await this.document.checkFilter(filter)
    }

    async completeField(field: string = "") {
        return await this.document.completeField(field)
    }

    async reset(filter: string = "") {
        await this.resetMutex.runExclusive(async () => {
            this.stopReset = false
            const columns: ConfigColumn[] = vscode.workspace.getConfiguration("crumbs").get("frameList.columns") || []
            const colorCoding: boolean = vscode.workspace.getConfiguration("crumbs").get("frameList.colorCoding") || false
            const message: FrameListInstanceResetMessage = { type: "frameListInstanceReset", columns: columns, colorCoding: colorCoding }
            this.webviewPanel.webview.postMessage(message)

            await this.getFrames(columns, filter)
        })
    }

    async getFrames(columns: ConfigColumn[], filter: string = "", skip: number = 0, limit: number = 5000) {
        const frames = await this.document.getFrames(columns, skip, limit, filter)

        if (Array.isArray(frames) && frames.length !== 0 && !this.stopReset) {
            const message: FrameListInstanceFramesMessage = { type: "frameListInstanceFrames", frames: frames }
            this.webviewPanel.webview.postMessage(message)

            await this.getFrames(
                columns,
                filter,
                skip + frames.length,
                vscode.workspace.getConfiguration("crumbs").get("frameList.chunkSize"))
        }
    }

    private async onMessage(message: FrameListWebviewMessage) {
        switch (message.type) {
            case "frameListWebviewReady":
                this.reset()
                break
            case "frameListWebviewFrameFocused":
                const frameNumber = (message as FrameListWebviewFrameFocusedMessage).frame
                const frame = await this.document.getFrame(frameNumber)
                this.frameExplorer.frameTreeDataProvider.setFrameTreeData(frame.tree)
                this.frameExplorer.frameHexProvider.reset(frame.bytes, frame.byteRanges)
                break
            case "frameListWebviewRevealFrameTree":
                await this.frameExplorer.reveal()
                const revealFrameMessage: FrameListInstanceRevealFrameMessage = {
                    type: "frameListInstanceRevealFrame",
                    rowNodeId: (message as FrameListWebviewRevealFrameTreeMessage).rowNodeId
                }
                this.webviewPanel.webview.postMessage(revealFrameMessage)
                break
        }
    }

    private onConfigure(event: vscode.ConfigurationChangeEvent) {
        if (event.affectsConfiguration("crumbs")) {
            this.resetMutex.cancel()
            this.stopReset = true
            this.reset()
        }
    }

    private onDidChangeViewState(event: vscode.WebviewPanelOnDidChangeViewStateEvent) {
        if (event.webviewPanel.active) {
            Context.setActiveDocumentPath(this.context, this.document.uri.path)
            Context.setActiveFrameListInstance(this.context, this)
        }
    }

    private onDidDispose() {
        if(Context.getActiveDocumentPath(this.context) == this.document.uri.path) {
            Context.setActiveDocumentPath(this.context, "")
            Context.setActiveFrameListInstance(this.context, undefined)
        }
    }

    private generateWebviewHtml(): string {
        const scriptUri = this.webviewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "out", "frameList.js")
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
