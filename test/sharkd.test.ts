import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { spawn } from "node:child_process";
import { Sharkd } from "../src/sharkd";

function transport(timeout = 1000, diagnostics = false) {
  const requests: { id: number; method: string }[] = [];
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: new Writable({
      write(data, _encoding, callback) {
        requests.push(JSON.parse(String(data)));
        callback();
      },
    }),
    kill: vi.fn(() => true),
  });
  const versionChild = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => true),
  });
  const log = vi.fn();
  const spawnMock = vi.fn((_path: string, args: string[]) =>
    args.includes("--version") ? versionChild : child,
  );
  const sharkd = new Sharkd("Default", "sharkd", {
    spawn: spawnMock as unknown as typeof spawn,
    startupTimeout: timeout,
    log: diagnostics ? log : undefined,
    capturePath: "/captures/test file.pcapng",
  });
  const respond = (id: number, result: unknown) =>
    child.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
  return { child, versionChild, log, sharkd, requests, spawnMock, respond };
}

afterEach(() => vi.useRealTimers());
describe("sharkd transport", () => {
  it("shares one startup and sends exactly one readiness request", async () => {
    const { sharkd, requests, spawnMock, respond } = transport();
    const first = sharkd.getClient();
    const second = sharkd.getClient();
    expect(second).toBe(first);
    expect(requests.map((request) => request.method)).toEqual(["status"]);
    respond(requests[0].id, { frames: 0 });
    expect(await first).toBe(await second);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    sharkd.stop();
  });
  it("decodes split UTF-8 JSON and multiple lines", async () => {
    const { sharkd, child, requests, respond } = transport();
    const ready = sharkd.getClient();
    respond(requests[0].id, {});
    const client = await ready;
    const info = client.request("info");
    const status = client.request("status");
    const encoded = Buffer.from(
      `${JSON.stringify({ jsonrpc: "2.0", id: requests[1].id, result: { version: "Grüße" } })}\n`,
    );
    const split = encoded.indexOf(Buffer.from("ü")) + 1;
    child.stdout.write(encoded.subarray(0, split));
    child.stdout.write(
      Buffer.concat([
        encoded.subarray(split),
        Buffer.from(
          `${JSON.stringify({ jsonrpc: "2.0", id: requests[2].id, result: { frames: 2 } })}\r\n\n`,
        ),
      ]),
    );
    expect(await info).toEqual({ version: "Grüße" });
    expect(await status).toEqual({ frames: 2 });
    sharkd.stop();
  });
  it("rejects startup errors immediately", async () => {
    const { sharkd, child } = transport();
    const result = expect(sharkd.getClient()).rejects.toThrow("ENOENT");
    child.emit("error", new Error("ENOENT"));
    await result;
    await expect(sharkd.getClient()).rejects.toThrow("ENOENT");
    sharkd.stop();
  });
  it("cleans up timeout without polling or leaving timers", async () => {
    vi.useFakeTimers();
    const { sharkd, child, requests } = transport(20);
    const result = expect(sharkd.getClient()).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(20);
    await result;
    expect(child.kill).toHaveBeenCalled();
    expect(requests).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["close", "malformed", "stop", "stdin"])(
    "rejects pending requests after %s",
    async (failure) => {
      const { sharkd, child, requests, respond } = transport();
      const ready = sharkd.getClient();
      respond(requests[0].id, {});
      const client = await ready;
      const pending = expect(
        Promise.resolve(client.request("analyse")),
      ).rejects.toThrow();
      if (failure === "close") {
        child.stderr.write("bad capture");
        child.emit("close", 1);
      }
      if (failure === "malformed") {
        child.stdout.write("not json\n");
      }
      if (failure === "stop") {
        sharkd.stop();
      }
      if (failure === "stdin") {
        child.stdin.emit("error", new Error("EPIPE"));
      }
      await pending;
      await expect(sharkd.getClient()).rejects.toThrow();
      await expect(Promise.resolve(client.request("info"))).rejects.toThrow();
      sharkd.stop();
    },
  );
  it("can stop during startup and before any process is spawned", async () => {
    const { sharkd, child } = transport();
    const result = expect(sharkd.getClient()).rejects.toThrow("stopped");
    sharkd.stop();
    sharkd.stop();
    await result;
    expect(child.kill).toHaveBeenCalled();
    const unstarted = new Sharkd();
    unstarted.stop();
    await expect(unstarted.getClient()).rejects.toThrow("stopped");
  });
});

describe("sharkd diagnostics", () => {
  it("records version/build output even when the configured profile fails", async () => {
    const { sharkd, child, versionChild, log, spawnMock } = transport(
      1000,
      true,
    );
    const ready = expect(sharkd.getClient()).rejects.toThrow("Invalid JSON");
    child.stderr.write('Configuration Profile "Default" does not exist\n');
    child.stdout.write("cannot initialize profile\n");
    await ready;
    versionChild.stdout.write(
      "Sharkd (Wireshark) 4.6.0\nCompiled with test libraries\n",
    );
    versionChild.emit("close", 0, null);
    const output = log.mock.calls.map(([message]) => message).join("\n");
    expect(spawnMock.mock.calls.map(([, args]) => args)).toEqual([
      ["--version"],
      ["--config-profile", "Default", "--foreground"],
    ]);
    expect(output).toContain("/captures/test file.pcapng");
    expect(output).toContain('Configuration Profile "Default" does not exist');
    expect(output).toContain("cannot initialize profile");
    expect(output).toContain(
      "Sharkd (Wireshark) 4.6.0\nCompiled with test libraries",
    );
    expect(output).toMatch(/version closed: code=0 signal=none \(\d+\.\d ms\)/);
    sharkd.stop();
  });

  it("logs complete malformed stdout, trailing chunks and stderr beyond the UI tail", async () => {
    const { sharkd, child, log } = transport(1000, true);
    const ready = expect(sharkd.getClient()).rejects.toThrow("Invalid JSON");
    const stderr = `first diagnostic\n${"x".repeat(12000)}\nlast diagnostic`;
    const stdout = `cannot initialize ${"y".repeat(12000)}`;
    child.stderr.write(stderr);
    child.stdout.write(`${stdout}\nsecond line without newline`);
    child.stdout.write("final stdout chunk");
    child.stderr.write("final stderr chunk");
    child.emit("close", 1, null);
    await ready;
    const output = log.mock.calls.map(([message]) => message).join("\n");
    for (const text of [
      stderr,
      stdout,
      "second line without newline",
      "final stdout chunk",
      "final stderr chunk",
    ]) {
      expect(output).toContain(text);
    }
    expect(output).toContain("reader closed: code=1 signal=none");
    sharkd.stop();
  });

  it.each(["close", "timeout"])(
    "preserves stdout without a final newline on %s",
    async (event) => {
      vi.useFakeTimers();
      const { sharkd, child, versionChild, log } = transport(20, true);
      const ready = expect(sharkd.getClient()).rejects.toThrow();
      versionChild.emit("close", 0, null);
      child.stdout.write("cannot initialize without newline");
      if (event === "close") {
        child.emit("close", 1, null);
      } else {
        await vi.advanceTimersByTimeAsync(20);
      }
      await ready;
      expect(log.mock.calls.map(([message]) => message).join("\n")).toContain(
        "cannot initialize without newline",
      );
      expect(vi.getTimerCount()).toBe(0);
      sharkd.stop();
    },
  );

  it("correlates concurrent request timings and preserves the full RPC error response", async () => {
    const { sharkd, requests, respond, child, log } = transport(1000, true);
    const ready = sharkd.getClient();
    respond(requests[0].id, {});
    const client = await ready;
    const failed = expect(
      client.request("load", { file: "/bad file.pcap" }),
    ).rejects.toThrow("load failed");
    const status = client.request("status");
    respond(requests[2].id, { frames: 0 });
    const response = JSON.stringify({
      jsonrpc: "2.0",
      id: requests[1].id,
      error: {
        code: -1,
        message: "load failed",
        data: { details: "z".repeat(12000) },
      },
    });
    child.stdout.write(`${response}\n`);
    await failed;
    await status;
    const output = log.mock.calls.map(([message]) => message).join("\n");
    expect(output).toContain('"params":{"file":"/bad file.pcap"}');
    expect(output).toContain(response);
    expect(output).toMatch(/RPC 2 load: error \(\d+\.\d ms\)/);
    expect(output).toMatch(/RPC 3 status: OK, \d+ bytes \(\d+\.\d ms\)/);
    sharkd.stop();
  });

  it("does not block startup on version probe failure and cleans up a hung probe", async () => {
    vi.useFakeTimers();
    const { sharkd, requests, respond, versionChild, log } = transport(
      1000,
      true,
    );
    const ready = sharkd.getClient();
    respond(requests[0].id, {});
    await ready;
    await vi.advanceTimersByTimeAsync(5000);
    expect(versionChild.kill).toHaveBeenCalledOnce();
    expect(log.mock.calls.map(([message]) => message).join("\n")).toContain(
      "version probe timed out",
    );
    sharkd.stop();
    expect(vi.getTimerCount()).toBe(0);

    const failedProbe = transport(1000, true);
    const secondReady = failedProbe.sharkd.getClient();
    failedProbe.versionChild.emit("error", new Error("version unavailable"));
    failedProbe.respond(failedProbe.requests[0].id, {});
    await secondReady;
    failedProbe.sharkd.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
