import * as vscode from "vscode"
import { spawn } from "child_process"

import Context from "./context"
import FrameListProvider from "./frameListProvider"

export function activate(context: vscode.ExtensionContext) {
    new FrameListProvider(context)

    vscode.commands.registerCommand("crumbs.openActiveInWireshark", () => {
        const activeDocumentPath = Context.getActiveDocumentPath(context)
        if (activeDocumentPath && activeDocumentPath.length > 0) {
            const wireshark: string = vscode.workspace.getConfiguration("crumbs").get("wireshark") || "wireshark"
            spawn(wireshark, [activeDocumentPath]).on("error", error => {
                vscode.window.showErrorMessage(`Could not start wireshark: ${error.message}`)
            })
        }
    })
}
