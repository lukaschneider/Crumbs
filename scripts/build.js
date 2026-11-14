const { spawnSync } = require("node:child_process");
const path = require("node:path");

process.chdir(path.join(__dirname, ".."));
const tsc = path.join("node_modules", "typescript", "bin", "tsc");
const steps = [
  [tsc, "--noEmit"],
  [tsc, "--noEmit", "-p", "src/webview"],
  [path.join("node_modules", "@biomejs", "biome", "bin", "biome"), "lint", "src", "test"],
  ["esbuild.js", ...process.argv.slice(2)],
];
for (const args of steps) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) { console.error(result.error); }
  if (result.status !== 0) { process.exit(result.status ?? 1); }
}
