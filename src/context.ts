import * as vscode from "vscode"
import FrameListInstance from "./frameListInstance"

export default abstract class Context {
    private static contextKey = {
        activeDocumentCount: "crumbs.context.activeDocumentCount",
        activeDocumentPath: "crumbs.context.activeDocumentPath",
        activeFrameListInstance: "crumbse.context.activeFrameListInstance",
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
    
    static setActiveFrameListInstance(context: vscode.ExtensionContext, frameListInstance?: FrameListInstance) {
        this.set(context, this.contextKey.activeFrameListInstance, frameListInstance)
    }

    static getActiveFrameListInstance(context: vscode.ExtensionContext): FrameListInstance | undefined {
        return context.workspaceState.get(this.contextKey.activeFrameListInstance)
    }
}
