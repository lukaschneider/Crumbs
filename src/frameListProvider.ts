import * as vscode from "vscode"

import Context from "./context"
import Document from "./document"
import FrameHexProvider from "./frameHexProvider"
import FrameListInstance from "./frameListInstance"
import FrameTree from "./frameTree"

export default class FrameListProvider implements vscode.CustomReadonlyEditorProvider {
    private context: vscode.ExtensionContext
    private frameTree: FrameTree
    private frameHexProvider: FrameHexProvider
    private openDocumentsCount: number

    constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.frameHexProvider = new FrameHexProvider(context)
        this.frameTree = new FrameTree()
        this.openDocumentsCount = 0

        vscode.window.registerCustomEditorProvider("crumbs.FrameList", this, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: true,
        })
        
    }

    openCustomDocument(uri: vscode.Uri): Document {
        Context.setActiveDocumentCount(this.context, ++this.openDocumentsCount)

        const document = new Document(uri)
        document.onDispose(() => {
            if (this.openDocumentsCount > 0) {
                Context.setActiveDocumentCount(this.context, --this.openDocumentsCount)
            }
        })

        return document
    }

    resolveCustomEditor(document: Document, webviewPanel: vscode.WebviewPanel): void {
        new FrameListInstance(document, webviewPanel, this.context, this.frameHexProvider, this.frameTree)
    }
}
