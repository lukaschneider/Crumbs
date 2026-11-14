import { type ChildProcess, spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { JSONRPCClient, type JSONRPCRequest } from "json-rpc-2.0";
import type { SharkdClient } from "./types/sharkd";

export interface SharkdOptions {
  spawn?: typeof spawn;
  startupTimeout?: number;
  log?: (message: string) => void;
}

export class Sharkd {
  #client?: SharkdClient;
  #starting?: Promise<SharkdClient>;
  #process?: ChildProcess;
  #failure?: Error;
  #stopped = false;

  constructor(
    private readonly profile = "Default",
    private readonly sharkdPath = "sharkd",
    private readonly options: SharkdOptions = {},
  ) {}

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
    const child = (this.options.spawn ?? spawn)(
      this.sharkdPath,
      ["--config-profile", this.profile, "--foreground"],
      { windowsHide: true, stdio: "pipe" },
    );
    this.#process = child;
    const client: SharkdClient = new JSONRPCClient(
      (request: JSONRPCRequest) => {
        return new Promise<void>((resolve, reject) => {
          if (this.#failure || this.#stopped || !child.stdin?.writable) {
            reject(this.#failure ?? new Error("Sharkd is not running"));
            return;
          }
          child.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      },
    );
    this.#client = client;
    let buffer = "";
    let stderr = "";
    const decoder = new StringDecoder("utf8");
    const fail = (error: Error) => {
      this.#failure ??= error;
      client.rejectAllPendingRequests(this.#failure.message);
      child.kill();
    };
    child.on("error", (error) =>
      fail(new Error(`Failed to start sharkd: ${error.message}`)),
    );
    child.stdin?.on("error", fail);
    child.stdout?.on("error", fail);
    child.stderr?.on("error", fail);
    child.stderr?.on("data", (data: Buffer) => {
      stderr = (stderr + data.toString()).slice(-4096);
      this.options.log?.(data.toString().trimEnd());
    });
    // close follows final stdout data, unlike exit (important for bye).
    child.on("close", (code, signal) => {
      fail(
        new Error(
          `Sharkd exited (${signal ?? code})${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
        ),
      );
    });
    child.stdout?.on("data", (data: Buffer) => {
      buffer += decoder.write(data);
      let end = buffer.indexOf("\n");
      while (end !== -1) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (line) {
          try {
            client.receive(JSON.parse(line));
          } catch {
            fail(new Error("Invalid JSON received from sharkd"));
            return;
          }
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
      return client;
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      throw this.#failure;
    } finally {
      clearTimeout(timeout);
    }
  }

  stop() {
    if (this.#stopped) {
      return;
    }
    this.#stopped = true;
    this.#client?.rejectAllPendingRequests("Sharkd is stopped");
    this.#process?.kill();
  }
}
export type { SharkdClient };
