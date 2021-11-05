import * as vscode from "vscode"
import FrameHexInstance from "./frameHexInstance"

export default class FrameHexProvider implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext
    private instance?: FrameHexInstance
    private currentBuffer: string
    private currentByteRanges: SharkdByteRange[]
    private focusFrameTreeItemAtRange: Function

    constructor(context: vscode.ExtensionContext, focusFrameTreeItemAtRange: Function) {
        this.context = context
        this.currentBuffer = ""
        this.currentByteRanges = []
        this.focusFrameTreeItemAtRange = focusFrameTreeItemAtRange

        vscode.window.registerWebviewViewProvider("crumbs.frameHex", this, {
            webviewOptions: { retainContextWhenHidden: true }
        })

        vscode.workspace.onDidChangeConfiguration(this.onConfigure.bind(this))
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.instance = new FrameHexInstance(this.context, webviewView, this.focusFrameTreeItemAtRange)
        this.reset(this.currentBuffer, this.currentByteRanges)
    }

    select(byteRange: SharkdByteRange) {
        this.instance?.select(byteRange)
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
