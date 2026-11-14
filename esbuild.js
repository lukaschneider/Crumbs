const esbuild = require("esbuild");
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");
let pending = 0;
const webviews = ["frameList", "frameHex", "frameTreeWelcome"];
const initial = new Set(["extension", ...webviews.map((name) => name.toLowerCase())]);
const matcher = (name) => ({
  name: "build-progress",
  setup(build) {
    build.onStart(() => {
      if (pending++ === 0) { console.log("[watch] build started"); }
    });
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(location ? `${location.file}:${location.line}:${location.column}: error: ${text}` : `error: ${text}`);
      }
      initial.delete(name);
      if (--pending === 0 && initial.size === 0) { console.log("[watch] build finished"); }
    });
  },
});

async function main() {
  const common = { bundle: true, minify: production, sourcemap: !production, logLevel: "silent" };
  const contexts = await Promise.all([
    esbuild.context({ ...common, entryPoints: ["src/extension.ts"], format: "cjs", platform: "node", target: "node22",
      outfile: "dist/extension.js", external: ["vscode"], tsconfig: "tsconfig.json", plugins: [matcher("extension")] }),
    ...webviews.map((name) => esbuild.context({
      ...common, entryPoints: [`src/webview/${name}.tsx`], format: "iife", platform: "browser", target: "chrome138",
      outfile: `dist/${name.toLowerCase()}.js`, tsconfig: "src/webview/tsconfig.json",
      define: { "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development") },
      plugins: [matcher(name.toLowerCase())],
    })),
  ]);
  if (watch) {
    await Promise.all(contexts.map((context) => context.watch()));
  } else {
    try { await Promise.all(contexts.map((context) => context.rebuild())); }
    finally { await Promise.all(contexts.map((context) => context.dispose())); }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
