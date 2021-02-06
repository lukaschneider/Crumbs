import * as vscode from "vscode";

import CrumbsEditorProvider from "./crumbsEditorProvider";
import CrumbsFrameTreeProvider from "./crumbsFrameTreeProvider";

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

    const crumbsFrameTreeProvider = new CrumbsFrameTreeProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider("crumbsFrameTree", crumbsFrameTreeProvider));
}
