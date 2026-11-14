import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
  type TypedJSONRPCServerAndClient,
} from "json-rpc-2.0";
import * as vscode from "vscode";
import type { FrameSelection } from "./frameSelection";
import type {
  TreeWelcomeMethods,
  TreeWelcomeWebviewMethods,
} from "./types/treeWelcome";
import { webviewHtml } from "./webviewHtml";

/** Native tree welcome content cannot host the shared illustrated empty state. */
export default class FrameTreeWelcomeProvider
  implements vscode.WebviewViewProvider
{
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly selection: FrameSelection,
  ) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "crumbsFrameTreeWelcome",
        this,
        {
          webviewOptions: { retainContextWhenHidden: true },
        },
      ),
    );
  }

  resolveWebviewView(view: vscode.WebviewView) {
    let revision = 0;
    let disposed = false;
    const snapshot = () => ({
      revision,
      hasFrame: this.selection.frame !== undefined,
    });
    const rpc: TypedJSONRPCServerAndClient<
      TreeWelcomeMethods,
      TreeWelcomeWebviewMethods
    > = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient(async (message) => {
        if (!disposed) {
          await view.webview.postMessage(message);
        }
      }),
    );
    rpc.addMethod("init", snapshot);
    const subscriptions = [
      view.webview.onDidReceiveMessage((message) => {
        void rpc.receiveAndSend(message);
      }),
      this.selection.onDidChange(() => {
        revision++;
        rpc.notify("selection", snapshot());
      }),
    ];
    subscriptions.push(
      view.onDidDispose(() => {
        disposed = true;
        rpc.rejectAllPendingRequests("Tree welcome view closed");
        for (const subscription of subscriptions) {
          subscription.dispose();
        }
      }),
    );
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
      ],
    };
    view.webview.html = webviewHtml(
      view.webview,
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "frametreewelcome.js",
      ),
    );
  }
}
