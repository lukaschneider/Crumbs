import * as vscode from "vscode";

import CrumbsEditorProvider from "./crumbsEditorProvider";
import CrumbsFrameTree from "./crumbsFrameTree";

export function activate(context: vscode.ExtensionContext) {
    const crumbsEditorProvider = new CrumbsEditorProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(CrumbsEditorProvider.viewType, crumbsEditorProvider, {
            supportsMultipleEditorsPerDocument: true,
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }),
    );

    new CrumbsFrameTree();
}
