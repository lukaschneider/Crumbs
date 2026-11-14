import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
  type TypedJSONRPCServerAndClient,
} from "json-rpc-2.0";
import * as vscode from "vscode";
import type { FrameSelection } from "./frameSelection";
import { getHexFrame } from "./hexData";
import type { FrameHexMethods, FrameHexWebviewMethods } from "./types/frameHex";
import type { ByteRange } from "./types/sharkd";
import { webviewHtml } from "./webviewHtml";

export default class FrameHex {
  constructor(
    view: vscode.WebviewView,
    context: vscode.ExtensionContext,
    selection: FrameSelection,
  ) {
    let revision = 0;
    let disposed = false;
    let frame = getHexFrame(selection.frame);
    const config = () => {
      const settings = vscode.workspace.getConfiguration("crumbs.frameHex");
      return {
        enableRowWrap: settings.get("enableRowWrap", true),
        rowLength: settings.get("rowLength", 16),
        setLength: settings.get("setLength", 8),
      };
    };
    const rpc: TypedJSONRPCServerAndClient<
      FrameHexMethods,
      FrameHexWebviewMethods
    > = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient(async (message) => {
        if (!disposed) {
          await view.webview.postMessage(message);
        }
      }),
    );
    rpc.addMethod("init", () => ({ ...config(), revision, frame }));
    rpc.addMethod("focus", async ({ byteRange }) => {
      await vscode.commands.executeCommand("frameTreeReveal", byteRange);
    });
    const disposables = [
      view.webview.onDidReceiveMessage((message) => {
        void rpc.receiveAndSend(message);
      }),
      selection.onDidChange((selected) => {
        frame = getHexFrame(selected);
        rpc.notify("frame", { revision: ++revision, frame });
      }),
      vscode.commands.registerCommand(
        "frameHexFocus",
        (byteRange: ByteRange = [0, 0]) => {
          rpc.notify("focus", { byteRange });
        },
      ),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("crumbs.frameHex")) {
          rpc.notify("config", config());
        }
      }),
    ];
    disposables.push(
      view.onDidDispose(() => {
        disposed = true;
        rpc.rejectAllPendingRequests("Hex view closed");
        disposables.forEach((disposable) => {
          disposable.dispose();
        });
      }),
    );
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
    };
    view.webview.html = webviewHtml(
      view.webview,
      vscode.Uri.joinPath(context.extensionUri, "dist", "framehex.js"),
    );
  }
}
