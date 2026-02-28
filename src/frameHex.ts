import {
  JSONRPCClient,
  type JSONRPCRequest,
  JSONRPCServer,
  JSONRPCServerAndClient,
  type TypedJSONRPCServerAndClient,
} from "json-rpc-2.0";
import { isEqual, uniqWith } from "lodash";
import * as vscode from "vscode";
import type {
  FrameHexMethods,
  FrameHexWebviewMethods,
  FrameRequest,
} from "./types/frameHex";
import type { ByteRange, FrameResponse, TreeNode } from "./types/sharkd";

export default class FrameHex {
  #webviewView: vscode.WebviewView;
  #context: vscode.ExtensionContext;
  #rpc: TypedJSONRPCServerAndClient<FrameHexMethods, FrameHexWebviewMethods>;

  constructor(
    webviewView: vscode.WebviewView,
    context: vscode.ExtensionContext,
  ) {
    this.#webviewView = webviewView;
    this.#context = context;

    // Setup webview
    this.#webviewView.webview.options = { enableScripts: true };
    this.#webviewView.webview.html = this.#generateWebviewHtml();

    // Setup API
    this.#rpc = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient((request: JSONRPCRequest) => {
        this.#webviewView.webview.postMessage(request);
      }),
    );

    this.#webviewView.webview.onDidReceiveMessage((message) => {
      this.#rpc.receiveAndSend(message);
    });

    this.#rpc.addMethod("init", () => {
      const config = vscode.workspace.getConfiguration("crumbs.frameHex");
      const enableRowWrap = config.get<boolean>("enableRowWrap", true);
      const rowLength = config.get<number>("rowLength", 16);
      const setLength = config.get<number>("setLength", 8);

      const frame = this.#getCurrentFrame();
      return { enableRowWrap, rowLength, setLength, frame };
    });

    this.#rpc.addMethod("focus", async (params) => {
      await vscode.commands.executeCommand("frameTreeReveal", params.byteRange);
    });

    // Setup command handlers
    this.#context.subscriptions.push(
      vscode.commands.registerCommand("frameHexUpdateFrame", () => {
        const frame = this.#getCurrentFrame();
        if (!frame) {
          return;
        }

        this.#rpc.request("frame", frame).then(() => {});
      }),
    );

    this.#context.subscriptions.push(
      vscode.commands.registerCommand(
        "frameHexFocus",
        async (byteRange?: ByteRange) => {
          if (!byteRange) {
            return;
          }

          this.#rpc.request("focus", { byteRange: byteRange });
        },
      ),
    );
  }

  #getCurrentFrame(): FrameRequest | undefined {
    const frame =
      this.#context.workspaceState.get<FrameResponse>("currentFrame");

    if (!frame || !frame.bytes || !frame.tree) {
      return;
    }

    const byteRanges: ByteRange[] = [];
    const getByteRanges = (node: TreeNode) => {
      if (node.n) {
        node.n.map(getByteRanges);
      }
      if (node.h) {
        byteRanges.push(node.h);
      }
    };
    frame.tree.map(getByteRanges);

    return {
      buffer: new Uint8Array(Buffer.from(frame.bytes, "base64")),
      byteRanges: uniqWith(byteRanges, isEqual),
    };
  }

  #generateWebviewHtml(): string {
    const scriptUri = this.#webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.#context.extensionUri, "dist", "framehex.js"),
    );
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="${scriptUri}"></script>
          <style>
            html, body, #root {
              font-family: var(--vscode-editor-font-family);
              font-size: var(--vscode-font-size);
              line-height: calc(var(--vscode-font-size) + 9px);
            }
          </style>
        </head>
        <body>
          <div id="root"/>
        </body>
      </html>`;
  }
}
