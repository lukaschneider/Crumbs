// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from "json-rpc-2.0";
import { TreeWelcomeView } from "../src/webview/TreeWelcomeView";
import type { TreeWelcomeState } from "../src/types/treeWelcome";

afterEach(cleanup);

it("keeps newer selection state over a delayed init and removes handlers when disposed", async () => {
  const rpc = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient(() => {}),
  );
  let finish: (state: TreeWelcomeState) => void = () => {};
  vi.spyOn(rpc, "request").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { unmount } = render(<TreeWelcomeView rpc={rpc} />);
  await act(async () => {
    await rpc.receiveAndSend({
      jsonrpc: "2.0",
      method: "selection",
      params: { revision: 1, hasFrame: true },
    });
    finish({ revision: 0, hasFrame: false });
  });
  expect(
    screen.getByRole("heading", { name: "No protocol fields to show" }),
  ).toBeDefined();
  await act(async () => {
    await rpc.receiveAndSend({
      jsonrpc: "2.0",
      method: "selection",
      params: { revision: 2, hasFrame: false },
    });
  });
  expect(
    screen.getByRole("heading", { name: "No packet selected" }),
  ).toBeDefined();
  unmount();
  expect(rpc.hasMethod("selection")).toBe(false);
});
