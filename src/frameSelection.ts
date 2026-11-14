import * as vscode from "vscode";
import type { FrameResponse } from "./types/sharkd";

/** Transient selection: packet contents are never saved in workspaceState. */
export class FrameSelection implements vscode.Disposable {
  #owner?: object;
  #revision = 0;
  #frame?: FrameResponse;
  #changed = new vscode.EventEmitter<FrameResponse | undefined>();
  readonly onDidChange = this.#changed.event;

  get frame() {
    return this.#frame;
  }
  get owner() {
    return this.#owner;
  }

  activate(owner: object, frame?: FrameResponse) {
    this.#owner = owner;
    this.#revision++;
    this.#frame = frame;
    this.#changed.fire(frame);
  }

  begin(owner: object) {
    if (this.#owner !== owner) {
      this.activate(owner);
    }
    return ++this.#revision;
  }

  commit(owner: object, revision: number, frame: FrameResponse) {
    if (this.#owner !== owner || revision !== this.#revision) {
      return false;
    }
    this.#frame = frame;
    this.#changed.fire(frame);
    return true;
  }

  clear(owner: object) {
    if (this.#owner === owner) {
      this.#owner = undefined;
      this.#revision++;
      this.#frame = undefined;
      this.#changed.fire(undefined);
    }
  }

  dispose() {
    this.#changed.dispose();
  }
}
