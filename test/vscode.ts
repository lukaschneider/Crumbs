/** biome-ignore-all lint/style/useNamingConvention: Mock members match VS Code enum names. */
import { vi } from "vitest";
import { fileURLToPath, pathToFileURL } from "node:url";

export class Disposable {
  #disposed = false;
  constructor(private readonly callback: () => void = () => {}) {}
  dispose() {
    if (!this.#disposed) {
      this.#disposed = true;
      this.callback();
    }
  }
}
export class EventEmitter<T> {
  #listeners = new Set<(value: T) => unknown>();
  readonly event = (listener: (value: T) => unknown) => {
    this.#listeners.add(listener);
    return new Disposable(() => {
      this.#listeners.delete(listener);
    });
  };
  fire(value: T) {
    for (const listener of this.#listeners) {
      listener(value);
    }
  }
  dispose() {
    this.#listeners.clear();
  }
}
export class Uri {
  constructor(
    readonly fsPath: string,
    readonly path: string = fsPath,
  ) {}
  static file(path: string) {
    return new Uri(path, pathToFileURL(path).pathname);
  }
  static joinPath(uri: Uri, ...parts: string[]) {
    return new Uri([uri.fsPath, ...parts].join("/"));
  }
  static parse(value: string) {
    return Uri.file(fileURLToPath(value));
  }
  toString() {
    return this.fsPath;
  }
}
export const configuration: Record<string, unknown> = {};
export const workspace = {
  getConfiguration: vi.fn((section: string) => ({
    get: (key: string, fallback?: unknown) =>
      configuration[`${section}.${key}`] ?? fallback,
  })),
  onDidChangeConfiguration: new EventEmitter<{
    affectsConfiguration: (key: string) => boolean;
  }>().event,
};
export const commands = {
  executeCommand: vi.fn(async () => {}),
  registerCommand: vi.fn(() => new Disposable()),
};
export const window = {
  registerWebviewViewProvider: vi.fn(
    (_id: string, _provider: unknown, _options?: unknown) => new Disposable(),
  ),
  createTreeView: vi.fn((_id: string, _options: unknown) => ({
    onDidChangeSelection: new EventEmitter<{ selection: TreeItem[] }>().event,
    reveal: vi.fn(async () => {}),
    dispose: vi.fn(),
  })),
  withProgress: vi.fn(async (_options: unknown, work: () => unknown) => work()),
  showErrorMessage: vi.fn(),
};
export const ProgressLocation = { Notification: 15 };
export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
export class TreeItem {
  id?: string;
  iconPath?: ThemeIcon;
  constructor(
    readonly label: string,
    readonly collapsibleState: number,
  ) {}
}
export class ThemeColor {
  constructor(readonly id: string) {}
}
export class ThemeIcon {
  constructor(
    readonly id: string,
    readonly color?: ThemeColor,
  ) {}
}
