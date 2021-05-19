import * as vscode from "vscode"

import PacketEditorProvider from "./packetEditorProvider"

export function activate(context: vscode.ExtensionContext) {
	new PacketEditorProvider(context)
}
