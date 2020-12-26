import * as vscode from "vscode";
import * as crumbs from "./crumbs";

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(crumbs.Provider.viewType, new crumbs.Provider(context), {
            supportsMultipleEditorsPerDocument: true,
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }),
    );
}
