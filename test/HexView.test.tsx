// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from "json-rpc-2.0";
import { HexView } from "../src/webview/HexView";
import type { FrameRequest, InitResponse } from "../src/types/frameHex";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function connection(
  frame: FrameRequest | null,
  overrides: Partial<InitResponse> = {},
  delayInit = false,
) {
  const rpc = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient(() => {}),
  );
  const init: InitResponse = {
    revision: 0,
    frame,
    rowLength: 16,
    setLength: 8,
    enableRowWrap: false,
    ...overrides,
  };
  let resolveInit: (value: InitResponse) => void = () => {};
  const pending = new Promise<InitResponse>((resolve) => {
    resolveInit = resolve;
  });
  vi.spyOn(rpc, "request").mockImplementation((method) =>
    method === "init"
      ? delayInit
        ? pending
        : Promise.resolve(init)
      : Promise.resolve(undefined),
  );
  const receive = (method: string, params: unknown) =>
    act(async () => {
      await rpc.receiveAndSend({ jsonrpc: "2.0", method, params });
    });
  return {
    rpc,
    init,
    receive,
    finishInit: () => act(async () => resolveInit(init)),
  };
}

const packet = (length: number): FrameRequest => ({
  bytes: Buffer.alloc(length, 65).toString("base64"),
  byteRanges: [
    [0, 2],
    [2, 2],
  ],
});

describe("hex webview", () => {
  it("distinguishes no selection from a packet without captured bytes", async () => {
    const { rpc, receive } = connection(null);
    render(<HexView rpc={rpc} />);
    expect(
      await screen.findByRole("heading", { name: "No packet selected" }),
    ).toBeDefined();
    await receive("frame", { revision: 1, frame: packet(0) });
    expect(
      await screen.findByRole("heading", { name: "No bytes in this packet" }),
    ).toBeDefined();
  });
  it("renders a bounded number of rows for a one-megabyte packet and scrolls to distant selections", async () => {
    const { rpc, receive } = connection(packet(1_000_000));
    const { container } = render(<HexView rpc={rpc} />);
    await screen.findByRole("button", { name: "Hex byte 0: 41" });
    expect(container.querySelectorAll("[data-row]").length).toBeLessThan(40);
    expect(container.querySelectorAll("button").length).toBeLessThan(1300);
    await receive("focus", { byteRange: [800000, 1] });
    expect(
      (
        await screen.findByRole("button", { name: "Hex byte 800000: 41" })
      ).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(container.querySelectorAll("[data-row]").length).toBeLessThan(40);
  });
  it("does not mutate the DOM while moving within the same highlighted field", async () => {
    const { rpc } = connection(packet(64));
    const { container } = render(<HexView rpc={rpc} />);
    const first = await screen.findByRole("button", { name: "Hex byte 0: 41" });
    const second = screen.getByRole("button", { name: "Hex byte 1: 41" });
    fireEvent.mouseEnter(first);
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    );
    observer.observe(container, {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    fireEvent.mouseEnter(second);
    await act(async () => {
      await Promise.resolve();
    });
    observer.disconnect();
    expect(mutations).toHaveLength(0);
    fireEvent.click(second);
    expect(rpc.request).toHaveBeenCalledWith("focus", { byteRange: [0, 2] });
  });
  it("clears old highlights and resets the scroll position when frames change", async () => {
    const { rpc, receive } = connection(packet(100_000));
    const { container } = render(<HexView rpc={rpc} />);
    await screen.findByRole("button", { name: "Hex byte 0: 41" });
    await receive("focus", { byteRange: [80000, 2] });
    await receive("frame", { revision: 1, frame: packet(4) });
    expect(
      await screen.findByRole("button", { name: "Hex byte 0: 41" }),
    ).toBeDefined();
    expect(container.querySelectorAll(".selected")).toHaveLength(0);
    expect(container.querySelector(".hex-view")?.scrollTop).toBe(0);
    await receive("frame", { revision: 2, frame: null });
    expect(
      await screen.findByRole("heading", { name: "No packet selected" }),
    ).toBeDefined();
  });
  it("does not overwrite a new frame with a delayed init response", async () => {
    const { rpc, receive, finishInit } = connection(packet(16), {}, true);
    render(<HexView rpc={rpc} />);
    await receive("frame", {
      revision: 1,
      frame: { bytes: "Qg==", byteRanges: [] },
    });
    await finishInit();
    expect(
      await screen.findByRole("button", { name: "Hex byte 0: 42" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Hex byte 0: 41" })).toBeNull();
  });
  it("normalizes unsafe settings, supports live configuration, and cleans up RPC handlers", async () => {
    const { rpc, receive } = connection(packet(32), {
      rowLength: 0,
      setLength: 0,
    });
    const { unmount, container } = render(<HexView rpc={rpc} />);
    await screen.findByRole("button", { name: "Hex byte 0: 41" });
    expect(container.querySelectorAll("[data-row]")).toHaveLength(2);
    await receive("config", {
      rowLength: 8,
      setLength: 4,
      enableRowWrap: true,
    });
    await waitFor(() =>
      expect(container.querySelectorAll("[data-row]")).toHaveLength(4),
    );
    unmount();
    expect(rpc.hasMethod("frame")).toBe(false);
    expect(rpc.hasMethod("focus")).toBe(false);
    expect(rpc.hasMethod("config")).toBe(false);
  });
});
