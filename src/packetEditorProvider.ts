import * as vscode from "vscode"

import Document from "./document"
import PacketEditorInstance from "./packetEditorInstance"

export default class PacketEditorProvider implements vscode.CustomReadonlyEditorProvider {
    private context: vscode.ExtensionContext

    constructor(context: vscode.ExtensionContext) {
        this.context = context

        vscode.window.registerCustomEditorProvider("crumbs.PacketEditor", this, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: true,
        })
    }

    openCustomDocument(uri: vscode.Uri): Document {
        return new Document(uri)
    }

    resolveCustomEditor(document: Document, webviewPanel: vscode.WebviewPanel): void {
        new PacketEditorInstance(document, webviewPanel, this.context)
    }
}
