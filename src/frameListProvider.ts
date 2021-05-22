import * as vscode from "vscode"

import Document from "./document"
import FrameListInstance from "./frameListInstance"

export default class FrameListProvider implements vscode.CustomReadonlyEditorProvider {
    private context: vscode.ExtensionContext

    constructor(context: vscode.ExtensionContext) {
        this.context = context

        vscode.window.registerCustomEditorProvider("crumbs.FrameList", this, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: true,
        })
    }

    openCustomDocument(uri: vscode.Uri): Document {
        return new Document(uri)
    }

    resolveCustomEditor(document: Document, webviewPanel: vscode.WebviewPanel): void {
        new FrameListInstance(document, webviewPanel, this.context)
    }
}
