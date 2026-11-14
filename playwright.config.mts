import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.CRUMBS_BROWSER || undefined,
    viewport: { width: 1000, height: 600 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/webviewServer.js",
    url: "http://127.0.0.1:4173/list",
    reuseExistingServer: false,
  },
});
