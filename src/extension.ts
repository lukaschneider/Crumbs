import * as vscode from "vscode";

import CrumbsEditorProvider from "./crumbsEditorProvider";

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(CrumbsEditorProvider.viewType, new CrumbsEditorProvider(context), {
            supportsMultipleEditorsPerDocument: true,
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }),
    );
}
