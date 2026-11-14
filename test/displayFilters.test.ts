import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import { CaptureFilters, columnLiterals } from "../src/captureFilters";
import {
  combineFilter,
  completionContext,
  filterOperations,
} from "../src/filterSyntax";
import { FilterHistory } from "../src/filterHistory";
import type { InfoResponse, SharkdClient } from "../src/types/sharkd";

describe("filter expressions and cursor context", () => {
  it("preserves grouping and negates the selected expression, including when no filter is active", () => {
    const results = filterOperations.map((operation) =>
      combineFilter("tcp || udp", 'dns.qry.name == "a b"', operation),
    );
    expect(results).toEqual([
      'dns.qry.name == "a b"',
      '!(dns.qry.name == "a b")',
      '(tcp || udp) && (dns.qry.name == "a b")',
      '(tcp || udp) || (dns.qry.name == "a b")',
      '(tcp || udp) && !(dns.qry.name == "a b")',
      '(tcp || udp) || !(dns.qry.name == "a b")',
    ]);
    expect(combineFilter("", "tcp", "and-not")).toBe("!(tcp)");
    expect(combineFilter("", "tcp", "or")).toBe("tcp");
  });
  it("replaces a whole field token at the caret without touching following expressions", () => {
    expect(completionContext("tcp.srcport == 443 && udp", 7)).toMatchObject({
      kind: "field",
      prefix: "tcp.src",
      from: 0,
      to: 11,
    });
    expect(completionContext("tcp && ip.", 10)).toMatchObject({
      kind: "field",
      prefix: "ip.",
      from: 7,
      to: 10,
    });
  });
  it("keeps quoted spaces, escaped quotes, and boolean operators inside string values", () => {
    const literal = JSON.stringify('a "quoted" || b');
    const text = `http.host == ${literal} && tcp`;
    const caret = text.indexOf("||") + 2;
    expect(completionContext('dns.qry.name == "a b" && tcp', 20)).toMatchObject(
      {
        kind: "value",
        field: "dns.qry.name",
        prefix: '"a b',
        from: 16,
        to: 21,
      },
    );
    expect(completionContext(text, caret)).toMatchObject({
      kind: "value",
      field: "http.host",
      from: 13,
      to: 13 + literal.length,
    });
  });
  it.each([
    ["tcp.port == ", "value", "tcp.port"],
    ["tcp.port ", "operator", "tcp.port"],
    ["tcp.port == 443 ", "operator", undefined],
    ["(tcp) && ", "field", undefined],
  ])("classifies %s", (text, kind, field) => {
    expect(
      completionContext(text as string, (text as string).length),
    ).toMatchObject({ kind });
    if (field) {
      expect(
        completionContext(text as string, (text as string).length),
      ).toHaveProperty("field", field);
    }
  });
});

describe("persistent filter history", () => {
  it("deduplicates and bounds history, serializes writes, and restores it in a new instance", async () => {
    let saved: unknown = ["tcp", "tcp", "", 42];
    const writes: string[][] = [];
    const storage = {
      get: () => saved,
      update: async (_key: string, values: string[]) => {
        await Promise.resolve();
        saved = values;
        writes.push(values);
      },
      keys: () => [],
    } as unknown as vscode.Memento;
    const history = new FilterHistory(storage);
    expect(history.items).toEqual(["tcp"]);
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        history.add(`frame.number == ${i + 1}`),
      ),
    );
    expect(history.items).toHaveLength(20);
    expect(writes.at(-1)).toEqual(history.items);
    await history.add("tcp");
    await history.add("tcp");
    expect(history.items.filter((item) => item === "tcp")).toHaveLength(1);
    expect(new FilterHistory(storage).items).toEqual(history.items);
    await history.remove("tcp");
    expect(history.items).not.toContain("tcp");
    await history.remove();
    expect(new FilterHistory(storage).items).toEqual([]);
    history.dispose();
  });
});

describe("Wireshark filter service", () => {
  it("extracts combined numeric/address fields without splitting strings or accepting expression text", () => {
    expect(columnLiterals("192.0.2.1,198.51.100.2", "FT_IPv4")).toEqual([
      "192.0.2.1",
      "198.51.100.2",
    ]);
    expect(columnLiterals("1234, 5678", "FT_UINT16")).toEqual(["1234", "5678"]);
    expect(columnLiterals('a,b "quoted"', "FT_STRING")).toEqual([]);
    expect(columnLiterals("53 || tcp", "FT_UINT16")).toEqual([]);
  });
  function service() {
    const request = vi.fn(
      async (
        method: string,
        params?: Record<string, unknown>,
      ): Promise<unknown> => {
        if (method === "complete") {
          return { field: [{ f: params?.field, t: 0, n: "Field" }] };
        }
        if (method === "check") {
          return { status: "OK" };
        }
        if (method === "intervals") {
          return { frames: 2 };
        }
        if (method === "frames") {
          return [
            { num: 1, c: ["a,b"] },
            { num: 2, c: ["a,b"] },
          ];
        }
        if (method === "frame") {
          return {
            tree: [
              {
                l: "Name",
                f: `dns.qry.name == ${JSON.stringify('a,b "quoted"')}`,
              },
              { l: "Name", f: 'dns.qry.name == "example.org"' },
            ],
          };
        }
        return {};
      },
    );
    const session = {
      client: { request } as unknown as SharkdClient,
      analyse: { frames: 5000, protocols: ["dns", "udp"] },
      info: { ftypes: ["FT_STRING"] } as InfoResponse,
    };
    return {
      filters: new CaptureFilters(async () => session),
      request,
      session,
    };
  }
  it("distinguishes invalid syntax from a failed reader and uses counts instead of fetching all rows", async () => {
    const { filters, request } = service();
    request.mockRejectedValueOnce(
      Object.assign(new Error("Filter invalid - bad syntax"), { code: -5001 }),
    );
    expect(await filters.validate("bad")).toEqual({
      valid: false,
      message: "bad syntax",
    });
    request.mockRejectedValueOnce(new Error("reader exited"));
    await expect(filters.validate("udp")).rejects.toThrow("reader exited");
    expect(await filters.count("")).toBe(5000);
    expect(await filters.count("udp")).toBe(2);
    expect(request).toHaveBeenLastCalledWith("intervals", {
      filter: "udp",
      interval: 4294967295,
    });
  });
  it("caches a bounded sample and preserves Wireshark's exact quoted values", async () => {
    const { filters, request } = service();
    const text = "dns.qry.name == ";
    filters.observe({
      tree: [{ l: "Selected name", f: 'dns.qry.name == "selected.org"' }],
    });
    const result = await filters.complete(text, text.length);
    expect(result.sampled).toBe(true);
    expect(result.items.map((item) => item.text)).toEqual([
      JSON.stringify('a,b "quoted"'),
      '"example.org"',
      '"selected.org"',
    ]);
    expect(request).toHaveBeenCalledWith("frames", {
      limit: 256,
      column0: "dns.qry.name:0",
    });
    const before = request.mock.calls.length;
    await filters.complete(`${text}"e`, text.length + 2);
    expect(request).toHaveBeenCalledTimes(before);
    expect(
      (await filters.complete(`${text}exa`, text.length + 3)).items.map(
        (item) => item.text,
      ),
    ).toEqual(['"example.org"']);
    filters.observe({
      tree: [{ l: "New name", f: 'dns.qry.name == "later.org"' }],
    });
    expect(
      (await filters.complete(text, text.length)).items.some(
        (item) => item.text === '"later.org"',
      ),
    ).toBe(true);
  });
  it("drops caches when the loaded reader changes", async () => {
    const { filters, request, session } = service();
    await filters.complete("dns.", 4);
    session.client = { request } as unknown as SharkdClient;
    await filters.complete("dns.", 4);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
