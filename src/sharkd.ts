import { type ChildProcess, spawn } from "node:child_process";
import { JSONRPCClient, type JSONRPCRequest } from "json-rpc-2.0";
import * as vscode from "vscode";
import type { SharkdClient } from "./types/sharkd";

const outputChannel = vscode.window.createOutputChannel(
  "Crumbs (sharkd)",
  "json",
);

class Sharkd {
  #profile: string;
  #sharkdPath: string;
  #client?: SharkdClient;
  #buffer: string = "";
  #process?: ChildProcess;

  constructor(profile: string = "Default", sharkdPath: string = "sharkd") {
    this.#profile = profile;
    this.#sharkdPath = sharkdPath;
  }

  async getClient(): Promise<SharkdClient> {
    if (this.#client && this.#process?.exitCode == null) {
      return this.#client;
    }

    return new Promise((resolve, reject) => {
      this.#process = spawn(this.#sharkdPath, [
        "--config-profile",
        this.#profile,
        "--foreground",
      ]);

      this.#process.on("error", (err) => {
        reject(new Error(`Failed to start sharkd: ${err.message}`));
      });

      this.#process.on("exit", (code) => {
        reject(new Error(`Sharkd exited unexpectedly with exit code: ${code}`));
      });

      this.#client = new JSONRPCClient((request: JSONRPCRequest) => {
        const message = `${JSON.stringify(request)}\n`;
        if (this.#process?.stdin) {
          outputChannel.appendLine(`${this.#process.pid}: ${message}`);
          this.#process.stdin.write(message);
        }
      });

      this.#process.stdout?.on("data", (data) => {
        this.#buffer += data.toString();

        const lines = this.#buffer.split("\n");
        this.#buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            const response = JSON.parse(line);
            this.#client?.receive(response);
          }
        }
      });

      const timeout = setTimeout(() => {
        this.#process?.kill();
        return reject(new Error("Failed to start sharkd: timeout"));
      }, 5000);

      const interval = setInterval(async () => {
        try {
          if (!this.#client) {
            return reject(new Error("Error creating sharkd client"));
          }

          await this.#client.request("status");

          clearTimeout(timeout);
          clearInterval(interval);
          return resolve(this.#client);
        } catch {
          // Not ready yet... retry
        }
      });
    });
  }

  stop() {
    this.#process?.kill();
  }
}

export { Sharkd, type SharkdClient };
