import * as vscode from "vscode"

import Document from "./document"
import FrameListInstance from "./frameListInstance"
import FrameTree from "./frameTree"

export default class FrameListProvider implements vscode.CustomReadonlyEditorProvider {
    private context: vscode.ExtensionContext
    private frameTree: FrameTree
    private openDocumentsCount: number

    constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.frameTree = new FrameTree()
        this.openDocumentsCount = 0

        vscode.window.registerCustomEditorProvider("crumbs.FrameList", this, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: true,
        })

    }

    openCustomDocument(uri: vscode.Uri): Document {
        vscode.commands.executeCommand("setContext", "crumbs.context.openDocumentsCount", ++this.openDocumentsCount)

        const document = new Document(uri)
        document.onDispose(() => {
            if (this.openDocumentsCount > 0) {
                vscode.commands.executeCommand("setContext", "crumbs.context.openDocumentsCount", --this.openDocumentsCount)
            }
        })

        return document
    }

    resolveCustomEditor(document: Document, webviewPanel: vscode.WebviewPanel): void {
        new FrameListInstance(document, webviewPanel, this.context, this.frameTree)
    }
}
