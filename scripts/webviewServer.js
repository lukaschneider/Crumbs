const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { webviewHtml } = require("../out/webviewHtml.js");

const theme = `:root {
  --vscode-font-family: Arial; --vscode-font-size: 13px;
  --vscode-editor-font-family: monospace; --vscode-editor-font-size: 13px;
  --vscode-editor-foreground: #cccccc; --vscode-editor-background: #181818;
  --vscode-editorPane-background: #242424; --vscode-editorGroup-border: #444;
  --vscode-icon-foreground: #ccc; --vscode-list-activeSelectionBackground: #094771;
  --vscode-list-activeSelectionForeground: #fff; --vscode-list-hoverBackground: #333;
  --vscode-list-hoverForeground: #fff; --vscode-editorActionList-background: #333;
  --vscode-editorActionList-foreground: #fff; --vscode-tree-tableOddRowsBackground: #222;
  --vscode-list-deemphasizedForeground: #999; --vscode-editorLineNumber-foreground: #999;
  --vscode-foreground: #ccc; --vscode-descriptionForeground: #999;
  --vscode-input-background: #313131; --vscode-input-foreground: #ddd;
  --vscode-input-border: #555; --vscode-input-placeholderForeground: #999;
  --vscode-focusBorder: #007fd4; --vscode-widget-border: #444; --vscode-widget-shadow: #0008;
  --vscode-inputValidation-errorBorder: #be1100; --vscode-errorForeground: #f48771;
  --vscode-button-secondaryForeground: #ddd; --vscode-button-secondaryBackground: #333;
  --vscode-button-secondaryHoverBackground: #444; --vscode-textLink-foreground: #8ab4f8;
  --vscode-button-background: #0078d4; --vscode-button-foreground: #fff;
  --vscode-button-hoverBackground: #026ec1; --vscode-toolbar-hoverBackground: #5a5d5e50;
  --vscode-toolbar-activeBackground: #63666750;
  --vscode-editorSuggestWidget-border: #454545; --vscode-editorSuggestWidget-background: #252526;
  --vscode-editorSuggestWidget-foreground: #d4d4d4; --vscode-editorSuggestWidget-selectedBackground: #04395e;
  --vscode-editorSuggestWidget-selectedForeground: #fff; --vscode-testing-iconPassed: #73c991;
  --vscode-editorWarning-foreground: #cca700;
} body { color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
/* Match the host webview's default code styling so list labels cannot accidentally inherit it. */
code { color: #ffd57a; background: #3c3c3c; padding: 0 3px; border-radius: 4px; }`;
http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:4173").pathname;
  if (/^\/dist\/(framelist|framehex|frametreewelcome)\.js(\.map)?$/.test(url)) {
    response.setHeader("Content-Type", url.endsWith(".js") ? "text/javascript" : "application/json");
    response.end(fs.readFileSync(path.join(__dirname, "..", url.slice(1))));
  } else if (url === "/list" || url === "/hex" || url === "/tree") {
    response.setHeader("Content-Type", "text/html");
    const script = url === "/tree" ? "/dist/frametreewelcome.js" : url === "/hex" ? "/dist/framehex.js" : "/dist/framelist.js";
    const html = webviewHtml({ asWebviewUri: (uri) => uri, cspSource: "'self'" }, script);
    response.end(html.replace("</head>", `<style>${theme}</style></head>`));
  } else { response.statusCode = url === "/favicon.ico" ? 204 : 404; response.end(); }
}).listen(4173, "127.0.0.1", () => console.log("Webview fixtures: http://127.0.0.1:4173/list"));
