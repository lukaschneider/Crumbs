import { inspect } from "node:util";
import * as vscode from "vscode";
import { Sharkd, type SharkdClient } from "./sharkd";
import { resolveSharkdPath } from "./sharkdPath";
import type { AnalyseResponse, InfoResponse } from "./types/sharkd";
import { CaptureFilters } from "./captureFilters";

let openDocumentCount = 0;

export default class PcapDocument implements vscode.CustomDocument {
  readonly filters = new CaptureFilters(() => this.load());
  sharkd: Sharkd;
  #disposed = false;
  #loaded?: Promise<{
    client: SharkdClient;
    analyse: AnalyseResponse;
    info: InfoResponse;
  }>;

  constructor(
    readonly uri: vscode.Uri,
    private readonly log?: (message: string) => void,
    private readonly onDispose?: () => void,
  ) {
    this.sharkd = this.#createSharkd();
    openDocumentCount++;
    this.#updateOpenDocumentCount();
  }

  load() {
    if (this.#disposed) {
      return Promise.reject(new Error("Capture is closed"));
    }
    if (!this.#loaded) {
      const loading = this.#load().catch((error) => {
        if (this.#loaded === loading) {
          this.#loaded = undefined;
        }
        throw error;
      });
      this.#loaded = loading;
    }
    return this.#loaded;
  }

  reset() {
    if (this.#disposed) {
      throw new Error("Capture is closed");
    }
    this.sharkd.stop();
    this.sharkd = this.#createSharkd();
    this.#loaded = undefined;
  }

  reportError(error: unknown) {
    this.log?.(
      `[${new Date().toISOString()}] ${this.uri.fsPath}: ${inspect(error, { depth: null, maxStringLength: null, maxArrayLength: null })}`,
    );
  }

  #createSharkd() {
    const config = vscode.workspace.getConfiguration("crumbs", this.uri);
    return new Sharkd(
      config.get("profile"),
      resolveSharkdPath(config.get<string>("sharkd")),
      { log: this.log, capturePath: this.uri.fsPath },
    );
  }

  async #load() {
    const client = await this.sharkd.getClient();
    await client.request("load", { file: this.uri.fsPath });
    const [analyse, info] = await Promise.all([
      client.request("analyse"),
      client.request("info"),
    ]);
    return { client, analyse, info };
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    openDocumentCount--;
    this.#updateOpenDocumentCount();
    this.sharkd.stop();
    this.onDispose?.();
  }

  #updateOpenDocumentCount() {
    void vscode.commands.executeCommand(
      "setContext",
      "openDocumentCount",
      openDocumentCount,
    );
  }
}
