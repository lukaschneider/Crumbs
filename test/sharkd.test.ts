import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { spawn } from "node:child_process";
import { Sharkd } from "../src/sharkd";

function transport(timeout = 1000) {
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
  const spawnMock = vi.fn(() => child);
  const sharkd = new Sharkd("Default", "sharkd", {
    spawn: spawnMock as unknown as typeof spawn,
    startupTimeout: timeout,
  });
  const respond = (id: number, result: unknown) =>
    child.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
  return { child, sharkd, requests, spawnMock, respond };
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
