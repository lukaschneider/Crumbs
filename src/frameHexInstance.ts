import * as vscode from "vscode"

export default class FrameHexInstance {
    private context: vscode.ExtensionContext
    private webviewView: vscode.WebviewView

    constructor(context: vscode.ExtensionContext, webviewView: vscode.WebviewView, webviewResolveContext: vscode.WebviewViewResolveContext, token: vscode.CancellationToken) {
        this.context = context
        this.webviewView = webviewView

        webviewView.webview.options = { enableScripts: true }
        webviewView.webview.html = this.generateWebviewHtml()
        webviewView.webview.onDidReceiveMessage(this.onMessage.bind(this))
    }

    setBuffer(buffer: string) {
        const message: FrameHexInstanceSetBufferMessage = {type: "frameHexInstanceSetBuffer", buffer: buffer}
        this.webviewView.webview.postMessage(message)
    }

    private onMessage(message: FrameHexWebviewMessage) {
        switch (message.type) {
            case "frameHexWebviewReady":
                break;
        }
    }

    private generateWebviewHtml(): string {
        const scriptUri = this.webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "out", "frameHex.js")
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