import * as vscode from "vscode"
import FrameHexInstance from "./frameHexInstance"

export default class FrameHexProvider implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext
    private instance?: FrameHexInstance
    private currentBuffer: string

    constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.currentBuffer = ""

        vscode.window.registerWebviewViewProvider("crumbs.frameHex", this, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        webviewResolveContext: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this.instance = new FrameHexInstance(this.context, webviewView, webviewResolveContext, token)
        this.setBuffer(this.currentBuffer)
    }

    setBuffer(buffer: string) {
        this.instance?.setBuffer(buffer)
        this.currentBuffer = buffer
    }
}
