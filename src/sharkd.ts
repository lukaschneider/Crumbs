import { type ChildProcess, spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { inspect } from "node:util";
import {
  JSONRPCClient,
  type JSONRPCRequest,
  type JSONRPCResponse,
} from "json-rpc-2.0";
import type { SharkdClient } from "./types/sharkd";

export interface SharkdOptions {
  spawn?: typeof spawn;
  startupTimeout?: number;
  log?: (message: string) => void;
  capturePath?: string;
}

let nextSession = 0;
const elapsed = (start: number) =>
  `${(performance.now() - start).toFixed(1)} ms`;

export class Sharkd {
  #client?: SharkdClient;
  #starting?: Promise<SharkdClient>;
  #process?: ChildProcess;
  #failure?: Error;
  #stopped = false;
  #session = ++nextSession;
  #stopVersion?: () => void;
  #pending = new Map<JSONRPCRequest["id"], { method: string; start: number }>();

  constructor(
    private readonly profile = "",
    private readonly sharkdPath = "sharkd",
    private readonly options: SharkdOptions = {},
  ) {}

  #log(message: string) {
    this.options.log?.(
      `[${new Date().toISOString()}] [sharkd ${this.#session}] ${message}`,
    );
  }

  #finishRequest(id: JSONRPCRequest["id"], outcome: string) {
    const pending = this.#pending.get(id);
    if (pending) {
      this.#log(
        `RPC ${id} ${pending.method}: ${outcome} (${elapsed(pending.start)})`,
      );
      this.#pending.delete(id);
    }
  }

  #rejectPending(message: string) {
    for (const id of this.#pending.keys()) {
      this.#finishRequest(id, `failed: ${message}`);
    }
    this.#client?.rejectAllPendingRequests(message);
  }

  #spawn(args: string[], label: string) {
    const start = performance.now();
    this.#log(
      `${label} command: ${JSON.stringify(this.sharkdPath)} args=${JSON.stringify(args)} cwd=${JSON.stringify(process.cwd())}`,
    );
    let child: ChildProcess;
    try {
      child = (this.options.spawn ?? spawn)(this.sharkdPath, args, {
        windowsHide: true,
        stdio: "pipe",
      });
    } catch (error) {
      this.#log(
        `${label} spawn failed (${elapsed(start)}): ${inspect(error, { depth: null, maxStringLength: null, maxArrayLength: null })}`,
      );
      throw error;
    }
    child.on("spawn", () =>
      this.#log(`${label} spawned pid=${child.pid} (${elapsed(start)})`),
    );
    child.on("error", (error) =>
      this.#log(
        `${label} process error (${elapsed(start)}): ${inspect(error, { depth: null, maxStringLength: null, maxArrayLength: null })}`,
      ),
    );
    child.on("close", (code, signal) =>
      this.#log(
        `${label} closed: code=${code} signal=${signal ?? "none"} (${elapsed(start)})`,
      ),
    );
    return child;
  }

  // Independent of the profile/JSON handshake so startup failures still have
  // version/build diagnostics. Diagnostic failure must not block capture loading.
  #probeVersion() {
    if (!this.options.log) {
      return;
    }
    let child: ChildProcess;
    try {
      child = this.#spawn(["--version"], "version");
    } catch {
      return;
    }
    for (const [name, stream] of [
      ["stdout", child.stdout],
      ["stderr", child.stderr],
    ] as const) {
      stream?.setEncoding("utf8");
      stream?.on("data", (data: string) =>
        this.#log(`version ${name}:\n${data}`),
      );
      stream?.on("error", (error) =>
        this.#log(
          `version ${name} error: ${inspect(error, { depth: null, maxStringLength: null, maxArrayLength: null })}`,
        ),
      );
    }
    const timer = setTimeout(() => {
      this.#log("version probe timed out after 5000 ms");
      child.kill();
    }, 5000);
    const cleanup = () => {
      clearTimeout(timer);
      this.#stopVersion = undefined;
    };
    child.on("error", cleanup);
    child.on("close", cleanup);
    this.#stopVersion = () => {
      cleanup();
      child.kill();
    };
  }

  getClient(): Promise<SharkdClient> {
    if (this.#stopped || this.#failure) {
      return Promise.reject(this.#failure ?? new Error("Sharkd is stopped"));
    }
    // Concurrent callers share the handshake; a failed session must not
    // silently restart without its loaded capture.
    this.#starting ??= this.#start();
    return this.#starting;
  }

  async #start(): Promise<SharkdClient> {
    const start = performance.now();
    this.#log(
      `Starting session: capture=${JSON.stringify(this.options.capturePath)} profile=${JSON.stringify(this.profile)}`,
    );
    this.#probeVersion();
    // Older versions require "-" for the default console session. Named
    // profiles select console mode via -C; neither needs --foreground.
    const child = this.#spawn(
      this.profile ? ["--config-profile", this.profile] : ["-"],
      "reader",
    );
    this.#process = child;
    const client: SharkdClient = new JSONRPCClient(
      (request: JSONRPCRequest) => {
        return new Promise<void>((resolve, reject) => {
          const json = JSON.stringify(request);
          this.#log(`RPC send: ${json}`);
          this.#pending.set(request.id, {
            method: request.method,
            start: performance.now(),
          });
          if (this.#failure || this.#stopped || !child.stdin?.writable) {
            const error = this.#failure ?? new Error("Sharkd is not running");
            this.#finishRequest(request.id, `failed: ${error.message}`);
            reject(error);
            return;
          }
          child.stdin.write(`${json}\n`, (error) => {
            if (error) {
              fail(error);
              reject(error);
            } else {
              if (request.id === undefined || request.id === null) {
                this.#finishRequest(request.id, "notification sent");
              }
              resolve();
            }
          });
        });
      },
    );
    this.#client = client;
    let buffer = "";
    let stderr = "";
    let invalidResponse = false;
    const closed = new Promise<void>((resolve) => child.once("close", resolve));
    const logBuffer = () => {
      if (buffer) {
        this.#log(`reader stdout (unprocessed):\n${buffer}`);
        buffer = "";
      }
    };
    const fail = (error: Error) => {
      if (!this.#failure && !this.#stopped) {
        this.#failure = error;
        this.#log(
          `Session failure (${elapsed(start)}): ${inspect(error, { depth: null, maxStringLength: null, maxArrayLength: null })}`,
        );
        logBuffer();
        this.#rejectPending(error.message);
        child.kill();
      }
    };
    child.on("error", (error) =>
      fail(
        new Error(`Failed to start sharkd: ${error.message}`, { cause: error }),
      ),
    );
    child.stdin?.on("error", fail);
    child.stdout?.on("error", fail);
    child.stderr?.on("error", fail);
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (data: string) => {
      // Only the UI error keeps a tail; the output channel gets every byte of text.
      stderr = (stderr + data).slice(-4096);
      this.#log(`reader stderr:\n${data}`);
    });
    const receive = (line: string) => {
      if (!line.trim()) {
        return;
      }
      try {
        const response: JSONRPCResponse = JSON.parse(line);
        // Reject non-protocol JSON rather than silently waiting for a timeout.
        if (
          response?.jsonrpc !== "2.0" ||
          !("id" in response) ||
          !("result" in response || "error" in response)
        ) {
          throw new Error("Expected a JSON-RPC response");
        }
        const pending = this.#pending.get(response.id);
        if (response.error) {
          this.#log(`RPC error response (full):\n${line}`);
        }
        if (pending?.method === "info" && response.result?.version) {
          this.#log(`sharkd reported version: ${response.result.version}`);
        }
        this.#finishRequest(
          response.id,
          response.error ? "error" : `OK, ${Buffer.byteLength(line)} bytes`,
        );
        client.receive(response);
      } catch (error) {
        this.#log(`reader stdout (invalid response, full):\n${line}`);
        invalidResponse = true;
        fail(new Error("Invalid JSON received from sharkd", { cause: error }));
      }
    };
    // close follows final stdout/stderr data, unlike exit (important for bye).
    child.on("close", (code, signal) => {
      if (buffer && !this.#failure && !this.#stopped) {
        const tail = buffer;
        buffer = "";
        receive(tail);
      }
      logBuffer();
      fail(
        new Error(
          `Sharkd exited (${signal ?? code})${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
        ),
      );
    });
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (data: string) => {
      buffer += data;
      if (this.#failure || this.#stopped) {
        logBuffer();
        return;
      }
      let end = buffer.indexOf("\n");
      while (end !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        receive(line);
        if (this.#failure) {
          return;
        }
        end = buffer.indexOf("\n");
      }
    });
    const timeout = setTimeout(
      () => fail(new Error("Failed to start sharkd: timeout")),
      this.options.startupTimeout ?? 5000,
    );
    try {
      // stdin queues until spawn; one status request is sufficient.
      await client.request("status");
      if (this.#failure || this.#stopped) {
        throw this.#failure ?? new Error("Sharkd is stopped");
      }
      this.#log(`Session ready (${elapsed(start)})`);
      return client;
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      if (invalidResponse && !this.#stopped) {
        // Startup diagnostics may arrive on stderr after malformed stdout.
        // Drain the killed process, but do not hang if it never closes.
        let drainTimeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            closed,
            new Promise<void>((resolve) => {
              drainTimeout = setTimeout(resolve, 100);
            }),
          ]);
        } finally {
          clearTimeout(drainTimeout);
        }
        if (stderr.trim() && this.#failure) {
          this.#failure = new Error(
            `${this.#failure.message}: ${stderr.trim()}`,
            { cause: this.#failure },
          );
        }
      }
      throw this.#failure ?? error;
    } finally {
      clearTimeout(timeout);
    }
  }

  stop() {
    if (this.#stopped) {
      return;
    }
    this.#stopped = true;
    this.#log("Stopping session");
    this.#rejectPending("Sharkd is stopped");
    this.#process?.kill();
    this.#stopVersion?.();
  }
}
export type { SharkdClient };
