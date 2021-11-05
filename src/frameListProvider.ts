import * as vscode from "vscode"

import Context from "./context"
import Document from "./document"
import FrameListInstance from "./frameListInstance"
import FrameExplorer from "./frameExplorer"

export default class FrameListProvider implements vscode.CustomReadonlyEditorProvider {
    private context: vscode.ExtensionContext
    private frameExplorer: FrameExplorer
    private openDocumentsCount: number

    constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.frameExplorer = new FrameExplorer(context)
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
        new FrameListInstance(document, webviewPanel, this.context, this.frameExplorer)
    }
}
