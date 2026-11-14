import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from "json-rpc-2.0";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

export function createWebviewRpc() {
  const vscode = acquireVsCodeApi();
  const rpc = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient((message) => vscode.postMessage(message)),
  );
  window.addEventListener("message", (event) => {
    void rpc.receiveAndSend(event.data);
  });
  return rpc;
}
