import * as vscode from "vscode"

export default abstract class Context {
    private static contextKey = {
        activeDocumentCount: "crumbs.context.activeDocumentCount",
        activeDocumentPath: "crumbs.context.activeDocumentPath",
    }

    private static set(context: vscode.ExtensionContext, key: string, value: any) {
        vscode.commands.executeCommand("setContext", key, value)
        context.workspaceState.update(key, value)
    }

    static setActiveDocumentCount(context: vscode.ExtensionContext, count: number) {
        this.set(context, this.contextKey.activeDocumentCount, count)
    }

    static getActiveDocumentCount(context: vscode.ExtensionContext): number | undefined {
        return context.workspaceState.get(this.contextKey.activeDocumentCount)
    }

    static setActiveDocumentPath(context: vscode.ExtensionContext, path: string) {
        this.set(context, this.contextKey.activeDocumentPath, path)
    }

    static getActiveDocumentPath(context: vscode.ExtensionContext): string | undefined {
        return context.workspaceState.get(this.contextKey.activeDocumentPath)
    }
}
