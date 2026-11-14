# Developing Crumbs

## Build and debug

Use Node.js 22.22.2+ or 24.15+ and npm. Install Wireshark with `sharkd` to open captures.

```sh
npm ci
npm run compile
```

Select **Run Extension** in VS Code and press **F5**. The `build` task checks the extension and webview TypeScript projects, lints the source, and bundles the extension before launching. It needs `node` on PATH and no problem-matcher extension. Development bundles include source maps.

Set extension-host breakpoints in files such as `src/extension.ts` and `src/frameList.ts`. For React views, run **Developer: Open Webview Developer Tools** in the development host. The protocol tree is a native VS Code TreeView; the frame list and hex view are React webviews.

Run `npm run watch` for incremental bundling. Reload the development host after extension-host changes; reopen a capture after webview bundle changes. `npm run check-types` checks source and test types. `npm run package` produces minified bundles, not a VSIX or Marketplace publication.

## Tests

- `npm test` runs type checks, lint, and deterministic transport, lifecycle, selection, filter/history/completion, column, and React DOM tests. Wireshark is not needed.
- `npm run test:webview` builds and runs Playwright checks against the bundled views: filters, history, grid selection, themes, CSP, empty states, layout, wrapping, and large packets. Run `npx playwright install chromium` first, or set `CRUMBS_BROWSER=msedge` to use installed Microsoft Edge.
- `npm run test:integration` builds and launches an isolated VS Code test profile with real sharkd. It downloads VS Code unless `VSCODE_EXECUTABLE_PATH` points to an existing executable. `SHARKD_PATH` overrides the automatically discovered sharkd path.

For example, in PowerShell:

```powershell
$env:CRUMBS_BROWSER = 'msedge'
npm run test:webview

$env:SHARKD_PATH = 'C:\Program Files\Wireshark\sharkd.exe'
$env:VSCODE_EXECUTABLE_PATH = "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe"
npm run test:integration
```

Integration-test data lives under `.vscode-test` and temporary capture files are removed after a run. Tests do not change normal VS Code settings.

`npm run lint` is read-only. Use `npm run lint:fix` or `npm run format` to change source formatting.

## Capture behavior

- Each editor pane owns its filter and packet-list state. Panes sharing a document reuse its sharkd session.
- Column settings accept Wireshark format codes and display fields, including occurrences such as `tcp.port:-1`. Run `tshark -G column-formats` to list format codes.
- Captured-value autocomplete samples the first 256 packets and packets subsequently inspected. Sampling, dissection, and completion results are cached and bounded.
- The hex view represents captured frame bytes. Tree fields from alternate sources, such as reassembled data, do not highlight unrelated offsets in those bytes.
- Windows automatically searches standard Wireshark installation folders before PATH. Custom `crumbs.sharkd` paths and `crumbs.profile` values are read when a capture session opens or is retried.

## Demo and Marketplace assets

`npm run demo:capture` rebuilds [samples/crumbs-demo.pcap](../samples/crumbs-demo.pcap) using only Node's standard library. The output is deterministic. See the [sample notes](../samples/README.md) for the traffic, Easter eggs, and original-commit reference.

The [icon source](../media/icon.svg) is editable SVG; the extension manifest uses the 256×256 transparent PNG for Marketplace compatibility. The README embeds a GIF of the real extension using the synthetic capture, with a still PNG as an alternative. See [media/README.md](../media/README.md) for asset details.

The manifest's repository URL controls relative README links on Marketplace. If this rewrite moves into the original repository, update `repository`, `homepage`, `bugs`, and the README's download link together before publishing.
