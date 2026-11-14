import * as vscode from "vscode";

const key = "crumbs.displayFilterHistory";
export class FilterHistory implements vscode.Disposable {
  #items: string[];
  #writes: Promise<void> = Promise.resolve();
  #changed = new vscode.EventEmitter<string[]>();
  readonly onDidChange = this.#changed.event;
  constructor(private readonly storage: vscode.Memento) {
    const stored = storage.get<unknown>(key);
    this.#items = Array.isArray(stored)
      ? [
          ...new Set(
            stored.filter(
              (value): value is string =>
                typeof value === "string" && value.trim().length > 0,
            ),
          ),
        ].slice(0, 20)
      : [];
  }
  get items() {
    return [...this.#items];
  }
  add(filter: string) {
    return this.#save(
      [filter, ...this.#items.filter((item) => item !== filter)]
        .filter(Boolean)
        .slice(0, 20),
    );
  }
  remove(filter?: string) {
    return this.#save(
      filter === undefined ? [] : this.#items.filter((item) => item !== filter),
    );
  }
  #save(items: string[]) {
    this.#items = items;
    this.#changed.fire(this.items);
    const write = this.#writes
      .catch(() => {})
      .then(() => this.storage.update(key, items));
    this.#writes = write;
    return write;
  }
  dispose() {
    this.#changed.dispose();
  }
}
