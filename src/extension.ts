import * as vscode from "vscode"

import FrameListProvider from "./frameListProvider"

export function activate(context: vscode.ExtensionContext) {
	new FrameListProvider(context)
}
