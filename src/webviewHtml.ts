import { randomBytes } from "node:crypto";
import type * as vscode from "vscode";

export function webviewHtml(webview: vscode.Webview, script: vscode.Uri) {
  const nonce = randomBytes(16).toString("hex");
  const scriptUri = webview.asWebviewUri(script);
  return `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <style>
    html, body, #root { width: 100%; height: 100%; padding: 0; margin: 0; }
    body { font-family: var(--vscode-font-family); user-select: none; }
    input, textarea, pre, [contenteditable="true"] { user-select: text; }
  </style>
  <script nonce="${nonce}" src="${scriptUri}" defer></script>
</head><body><div id="root"></div></body></html>`;
}
