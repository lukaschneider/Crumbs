import * as vscode from "vscode"
import FrameHexInstance from "./frameHexInstance"

export default class FrameHexProvider implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext
    private instance?: FrameHexInstance
    private currentBuffer: string
    private currentByteRanges: SharkdByteRange[]

    constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.currentBuffer = ""
        this.currentByteRanges = []

        vscode.window.registerWebviewViewProvider("crumbs.frameHex", this, {
            webviewOptions: { retainContextWhenHidden: true }
        })

        vscode.workspace.onDidChangeConfiguration(this.onConfigure.bind(this))
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        webviewResolveContext: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this.instance = new FrameHexInstance(this.context, webviewView, webviewResolveContext, token)
        this.reset(this.currentBuffer, this.currentByteRanges)
    }

    reset(buffer: string, byteRanges: SharkdByteRange[]) {
        this.instance?.reset(buffer, byteRanges)
        this.currentBuffer = buffer
        this.currentByteRanges = byteRanges
    }

    private onConfigure() {
        this.instance?.reset(this.currentBuffer, this.currentByteRanges)
    }
}
