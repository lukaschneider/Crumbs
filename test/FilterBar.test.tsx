// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from "json-rpc-2.0";
import { FilterBar } from "../src/webview/FilterBar";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("discards stale validation and completion results while typing", async () => {
  vi.useFakeTimers();
  const rpc = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient(() => {}),
  );
  const pending = new Map<string, (value: unknown) => void>();
  vi.spyOn(rpc, "request").mockImplementation(
    (method, params) =>
      new Promise((resolve) =>
        pending.set(
          `${method}:${(params as { filter?: string; text?: string }).filter ?? (params as { text: string }).text}`,
          resolve,
        ),
      ),
  );
  render(
    <FilterBar
      rpc={rpc}
      state={{ filter: "", revision: 0, numRows: 2 }}
      initialHistory={[]}
      onApplied={() => {}}
    />,
  );
  const input = screen.getByRole("combobox") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "tcp." } });
  await act(() => vi.advanceTimersByTimeAsync(250));
  fireEvent.change(input, { target: { value: "udp" } });
  await act(() => vi.advanceTimersByTimeAsync(250));
  await act(async () => {
    pending.get("validateFilter:udp")?.({ valid: true });
    pending.get("completeFilter:udp")?.({
      from: 0,
      to: 3,
      items: [{ text: "udp.port", description: "UDP port", kind: "field" }],
    });
  });
  await act(async () => {
    pending.get("validateFilter:tcp.")?.({
      valid: false,
      message: "Old error",
    });
    pending.get("completeFilter:tcp.")?.({
      from: 0,
      to: 4,
      items: [{ text: "tcp.port", description: "TCP port", kind: "field" }],
    });
  });
  expect(input.getAttribute("aria-invalid")).toBe("false");
  expect(screen.queryByText("Old error")).toBeNull();
  expect(screen.getByRole("option").textContent).toContain("udp.port");
  expect(screen.queryByText("tcp.port")).toBeNull();
});

it.each([
  { operator: "&&", operand: "udp", kind: "field", click: false },
  { operator: "||", operand: "udp", kind: "field", click: true },
  { operator: "==", operand: "443", kind: "value", click: false },
])(
  "offers the next operand immediately after accepting $operator",
  async ({ operator, operand, kind, click }) => {
    vi.useFakeTimers();
    const rpc = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient(() => {}),
    );
    const before = operator === "==" ? "tcp.port " : "tcp ";
    const after = `${before}${operator} `;
    const request = vi
      .spyOn(rpc, "request")
      .mockImplementation(async (method, params) => {
        if (method === "validateFilter") {
          return { valid: true };
        }
        const { text } = params as { text: string };
        return {
          from: text.length,
          to: text.length,
          items:
            text === before
              ? [
                  {
                    text: `${operator} `,
                    description: "Operator",
                    kind: "operator",
                  },
                ]
              : [{ text: operand, description: "Next operand", kind }],
        };
      });
    render(
      <FilterBar
        rpc={rpc}
        state={{ filter: "", revision: 0, numRows: 2 }}
        initialHistory={[]}
        onApplied={() => {}}
      />,
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: before } });
    await act(() => vi.advanceTimersByTimeAsync(250));
    if (click) {
      fireEvent.click(screen.getByRole("option"));
    } else {
      fireEvent.keyDown(input, { key: "Tab" });
    }
    expect(input.value).toBe(after);
    expect(input.selectionStart).toBe(after.length);
    expect(document.activeElement).toBe(input);
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(request).toHaveBeenCalledWith("completeFilter", {
      text: after,
      cursor: after.length,
    });
    expect(screen.getByRole("option").textContent).toContain(operand);
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input.value).toBe(`${after}${operand}`);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      request.mock.calls.some(([method]) => method === "applyFilter"),
    ).toBe(false);
  },
);

it("prepares tree expressions without applying, shares history updates, and removes handlers on disposal", async () => {
  const rpc = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient(() => {}),
  );
  const request = vi.spyOn(rpc, "request").mockResolvedValue({ valid: true });
  const { unmount } = render(
    <FilterBar
      rpc={rpc}
      state={{ filter: "tcp", revision: 1, numRows: 1 }}
      initialHistory={[]}
      onApplied={() => {}}
    />,
  );
  await act(async () => {
    await rpc.receiveAndSend({
      jsonrpc: "2.0",
      method: "prepareFilter",
      params: { filter: "(tcp) || (udp)" },
    });
    await rpc.receiveAndSend({
      jsonrpc: "2.0",
      method: "history",
      params: ["dns"],
    });
  });
  const input = screen.getByRole("combobox") as HTMLInputElement;
  expect(input.value).toBe("(tcp) || (udp)");
  expect(document.activeElement).toBe(input);
  expect(request.mock.calls.some(([method]) => method === "applyFilter")).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "Recent filters" }));
  expect(screen.getByRole("button", { name: "dns" })).toBeDefined();
  unmount();
  expect(rpc.hasMethod("history")).toBe(false);
  expect(rpc.hasMethod("prepareFilter")).toBe(false);
});
