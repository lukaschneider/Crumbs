/* Messages from the Webview to the Editor */
interface WebviewMessage {
    type: "ready";
    body?: any;
}

interface WebviewReadyMessage extends WebviewMessage {}

/* Messages from the Editor to the Webview */
interface EditorMessage {
    type: "setColumns" | "appendRows" | "setRows";
    body?: any;
}

interface EditorSetColumnsMessage extends EditorMessage {
    body?: CrumbsConfigColumn[];
}

interface EditorAppendRowsMessage extends EditorMessage {
    body: SharkdRow[];
}

interface EditorSetRowsMessage extends EditorMessage {
    body: SharkdRow[];
}
