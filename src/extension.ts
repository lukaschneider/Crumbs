import * as vscode from "vscode";

import CrumbsEditorProvider from "./crumbsEditorProvider";
import CrumbsFrameTree from "./crumbsFrameTree";

export function activate(context: vscode.ExtensionContext) {
    new CrumbsEditorProvider(context);
    new CrumbsFrameTree();
}
