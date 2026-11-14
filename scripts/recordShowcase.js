// Record real Crumbs interactions in an isolated VS Code profile.
// Requires a built extension, VS Code, and Wireshark. No mocked packet data.
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function main() {
  const executable = process.env.VSCODE_EXECUTABLE_PATH || (process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA, "Programs/Microsoft VS Code/Code.exe") : "");
  if (!executable) throw new Error("Set VSCODE_EXECUTABLE_PATH to the VS Code executable.");
  await fs.access(executable);
  await fs.access(path.join(root, "dist/extension.js"));
  await fs.mkdir(path.join(root, "out"), { recursive: true });
  const run = await fs.mkdtemp(path.join(root, "out/showcase-"));
  const profile = path.join(run, "profile");
  const frames = path.join(run, "frames");
  await fs.mkdir(path.join(profile, "User"), { recursive: true });
  await fs.mkdir(frames);
  const settings = {
    "workbench.colorTheme": "Default Dark Modern",
    "window.zoomLevel": 0,
    "window.commandCenter": false,
    "window.menuBarVisibility": "hidden",
    "workbench.startupEditor": "none",
    "workbench.tips.enabled": false,
    "workbench.enableExperiments": false,
    "workbench.activityBar.location": "hidden",
    "workbench.editorAssociations": { "*.pcap": "crumbsFrameList" },
    "security.workspace.trust.enabled": false,
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
    "extensions.autoCheckUpdates": false,
    "extensions.autoUpdate": false,
    "chat.disableAIFeatures": true,
    "breadcrumbs.enabled": false,
    "editor.fontSize": 14,
    "editor.fontFamily": "Consolas, monospace",
    "crumbs.frameList.colorCoding": true,
    ...(process.env.SHARKD_PATH ? { "crumbs.sharkd": process.env.SHARKD_PATH } : {}),
  };
  await fs.writeFile(path.join(profile, "User/settings.json"), JSON.stringify(settings));
  const port = await freePort();
  await fs.writeFile(path.join(run, "argv.json"), JSON.stringify({ "remote-debugging-port": String(port) }));
  const host = spawn(executable, [
    `--user-data-dir=${profile}`, `--extensions-dir=${path.join(run, "extensions")}`,
    `--extensionDevelopmentPath=${root}`, `--remote-debugging-port=${port}`,
    "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes", "--new-window",
    path.join(root, "samples/crumbs-demo.pcap"),
  ], { windowsHide: true, stdio: "ignore", env: { ...process.env, VSCODE_PORTABLE: run } });
  let launchError;
  host.on("error", (error) => { launchError = error; });
  let browser;
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (launchError) throw launchError;
      if (host.exitCode !== null) throw new Error(`VS Code exited with code ${host.exitCode}.`);
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 }); break; }
      catch { await delay(500); }
    }
    if (!browser) throw new Error("Could not connect to the isolated VS Code window.");
    let page;
    for (let attempt = 0; attempt < 60; attempt++) {
      page = browser.contexts()[0].pages().find((p) => p.url().includes("workbench.html"));
      if (page) break;
      await delay(500);
    }
    if (!page) throw new Error("VS Code workbench did not open.");
    page.setDefaultTimeout(15000);
    await page.setViewportSize({ width: 1200, height: 800 });
    let list;
    for (let attempt = 0; attempt < 60; attempt++) {
      for (const frame of page.frames()) {
        if (await frame.getByRole("combobox", { name: "Display filter" }).count()) { list = frame; break; }
      }
      if (list) break;
      await delay(500);
    }
    if (!list) {
      await page.screenshot({ path: path.join(run, "failure.png") });
      throw new Error(`The frame list did not load. ${await page.locator("body").innerText()}\nScreenshot: ${path.join(run, "failure.png")}`);
    }
    const input = list.getByRole("combobox", { name: "Display filter" });
    const tree = (text) => page.getByRole("treeitem").filter({ hasText: text });
    const shots = [];
    const capture = async (caption, duration, keepMouse = false, still = false) => {
      if (!keepMouse) await page.mouse.move(1100, 790);
      await delay(400);
      const file = `${String(shots.length).padStart(2, "0")}.png`;
      await page.screenshot({ path: path.join(frames, file), clip: { x: 0, y: 30, width: 1200, height: 742 } });
      shots.push({ file, caption, delay: duration, ...(still ? { still: true } : {}) });
      console.log(`Recorded ${caption}`);
    };
    const selectPacket = async (index) => {
      await list.locator(`.ag-row[row-index="${index}"]`).dblclick();
      await tree("Hypertext Transfer Protocol").waitFor();
      // Allow the double-click's asynchronous tree reveal to finish before a field click.
      await delay(700);
    };
    const expand = async (text) => {
      const node = tree(text);
      await node.waitFor();
      await node.click();
      if (await node.getAttribute("aria-expanded") === "false") await page.keyboard.press("ArrowRight");
    };
    await list.getByText("37 of 37 packets", { exact: true }).waitFor();
    await selectPacket(7);
    const sash = page.locator(".monaco-sash.horizontal:not(.disabled)");
    const box = await sash.boundingBox();
    await page.mouse.move(580, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(580, 405, { steps: 12 });
    await page.mouse.up();
    await expand("Hypertext Transfer Protocol");
    await capture("Explore packet captures without leaving VS Code", 2200);
    await input.fill("http.request");
    await list.getByRole("option").first().waitFor();
    await capture("Autocomplete for protocols and field names", 2200);
    await input.fill("http");
    await input.press("Enter");
    await list.getByText(/4 of 37 packets/).waitFor();
    await selectPacket(0);
    await capture("Apply a Wireshark display filter with Enter", 1800);
    await expand("Hypertext Transfer Protocol");
    await expand(/^GET \/since/);
    const uri = tree(/^Request URI: /);
    await uri.click();
    await capture("Select a protocol field to highlight its bytes", 2600, false, true);
    await uri.hover();
    await page.mouse.wheel(0, 132);
    await delay(300);
    await uri.click({ button: "right" });
    await page.getByRole("menuitem", { name: /Apply as filter/ }).waitFor();
    await capture("Build a filter directly from a protocol field", 1600);
    await page.getByRole("menuitem", { name: /Apply as filter/ }).hover();
    await page.getByRole("menuitem", { name: "Selected", exact: true }).waitFor();
    await capture("Apply now, or prepare an expression to edit first", 2300, true);
    await page.getByRole("menuitem", { name: "Selected", exact: true }).click();
    await list.getByText(/2 of 37 packets/).waitFor();
    await selectPacket(0);
    await capture("Keep only the packets that matter", 1800);
    await list.getByRole("button", { name: "Recent filters", exact: true }).click();
    await list.getByRole("region", { name: "Recent display filters" }).waitFor();
    await capture("Recall recent filters across captures and workspaces", 2300);
    await list.getByRole("button", { name: "http", exact: true }).click();
    await input.press("Enter");
    await list.getByText(/4 of 37 packets/).waitFor();
    await selectPacket(0);
    await input.fill("http.response.code == 4");
    await list.getByRole("option", { name: /^418/ }).waitFor();
    await capture("Suggest values actually observed in the capture", 2200);
    await list.getByRole("option", { name: /^418/ }).click();
    await input.press("Enter");
    await list.getByText(/1 of 37 packets/).waitFor();
    await selectPacket(0);
    await expand("Hypertext Transfer Protocol");
    await expand(/^HTTP\/1.1 418/);
    await tree(/^Status Code: 418/).click();
    await capture("Follow a response all the way down to its bytes", 2600);
    const manifest = path.join(frames, "manifest.json");
    await fs.writeFile(manifest, JSON.stringify(shots, null, 2));
    const result = spawnSync(process.execPath, [path.join(__dirname, "buildMedia.js"), manifest], { stdio: "inherit" });
    if (result.status !== 0) throw new Error("Media encoding failed.");
    console.log(`Raw recording retained in ${frames}`);
  } finally {
    await browser?.close(); // Disconnect Playwright before stopping only our own host.
    if (host.pid && host.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(host.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      else host.kill("SIGTERM");
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
