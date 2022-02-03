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

    vscode.commands.registerCommand("crumbs.applyDisplayFilter", () => {
        const activeFrameListInstance = Context.getActiveFrameListInstance(context)

        if (!activeFrameListInstance) {
            return
        }

        const input = vscode.window.createQuickPick()
        input.title = "Apply Display Filter"
        input.placeholder = "Display Filter"
        input.value = activeFrameListInstance.displayFilter
        input.ignoreFocusOut = true

        let checkResult: { ok: boolean, message?: string }

        input.onDidChangeValue(async filter => {
            if (filter == "") {
                input.items = []
                return
            }

            checkResult = await activeFrameListInstance.checkFilter(filter)

            input.items = [{
                label: filter,
                detail: !checkResult.ok ? checkResult.message : undefined
            }]

            const splitFilter = filter.split(/(\s*\&\&\s*|\s*\|\|\s*)/g)

            const lastFilter = splitFilter.pop()
            const predictions = await activeFrameListInstance.completeField(lastFilter)

            if (!predictions || predictions.length == 0) {
                return
            }

            input.items = input.items.concat(predictions.map(prediction => {
                return {
                    label: splitFilter.join("") + prediction.f,
                    description: prediction.n
                }
            }))
        })

        input.onDidAccept(() => {
            if (!checkResult.ok) {
                return
            }

            activeFrameListInstance.displayFilter = input.value
            activeFrameListInstance.reset(input.value)
            input.dispose()
        })

        input.onDidChangeSelection(items => {
            if (items.length == 0) {
                return
            }

            input.value = items[0].label
        })

        input.show()
    })
}
