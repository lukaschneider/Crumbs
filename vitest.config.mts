import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { vscode: resolve(import.meta.dirname, "test/vscode.ts") } },
  test: { include: ["test/**/*.test.{ts,tsx}"], restoreMocks: true, clearMocks: true },
});
