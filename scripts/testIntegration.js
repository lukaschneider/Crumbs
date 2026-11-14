const { runTests } = require("@vscode/test-electron");
const path = require("node:path");
const extensionDevelopmentPath = path.resolve(__dirname, "..");
runTests({
  extensionDevelopmentPath,
  extensionTestsPath: path.join(extensionDevelopmentPath, "out/test/index.js"),
  vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
  extensionTestsEnv: { ...process.env, CRUMBS_EXTENSION_PATH: extensionDevelopmentPath },
  launchArgs: ["--disable-extensions", "--skip-welcome", "--skip-release-notes", "--disable-workspace-trust"],
}).catch((error) => { console.error(error); process.exitCode = 1; });
