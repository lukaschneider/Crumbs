import { expect, it, vi } from "vitest";
import * as vscode from "vscode";
import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from "json-rpc-2.0";
import { EventEmitter } from "./vscode";
import { FrameSelection } from "../src/frameSelection";
import FrameTreeWelcomeProvider from "../src/frameTreeWelcomeProvider";

it("initializes welcome views from the selection and disposes message subscriptions", async () => {
  const selection = new FrameSelection();
  const owner = {};
  selection.commit(owner, selection.begin(owner), { tree: [] });
  const incoming = new EventEmitter<unknown>();
  const closed = new EventEmitter<void>();
  const client = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient((message) => incoming.fire(message)),
  );
  const update = vi.fn();
  client.addMethod("selection", update);
  const postMessage = vi.fn(async (message) => {
    await client.receiveAndSend(message);
    return true;
  });
  const context = {
    subscriptions: [],
    extensionUri: vscode.Uri.file("extension"),
  } as unknown as vscode.ExtensionContext;
  const provider = new FrameTreeWelcomeProvider(context, selection);
  provider.resolveWebviewView({
    webview: {
      options: {},
      html: "",
      cspSource: "test",
      asWebviewUri: (uri: vscode.Uri) => uri,
      postMessage,
      onDidReceiveMessage: incoming.event,
    },
    onDidDispose: closed.event,
  } as unknown as vscode.WebviewView);
  expect(await client.request("init", undefined)).toEqual({
    revision: 0,
    hasFrame: true,
  });
  selection.clear(owner);
  await vi.waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      { revision: 1, hasFrame: false },
      undefined,
    ),
  );
  closed.fire();
  const messageCount = postMessage.mock.calls.length;
  selection.activate(owner);
  expect(postMessage).toHaveBeenCalledTimes(messageCount);
  for (const disposable of context.subscriptions) {
    disposable.dispose();
  }
  selection.dispose();
});
