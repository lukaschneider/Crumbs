/* Messages from the Webview to the Editor */
interface WebviewMessage {
    type: "ready" | "setFrameTree" | "focusFrameTree";
}

interface WebviewReadyMessage extends WebviewMessage {
    type: "ready";
}

interface WebviewSetFrameTreeMessage extends WebviewMessage {
    type: "setFrameTree";
    frameNumber: number;
}

interface WebviewfocusFrameTreeMessage extends WebviewMessage {
    type: "focusFrameTree";
    rowId: string;
}

/* Messages from the Editor to the Webview */
interface EditorMessage {
    type: "setColumns" | "appendRows" | "setRows" | "ensureRowVisible";
}

interface EditorSetColumnsMessage extends EditorMessage {
    type: "setColumns";
    body?: CrumbsConfigColumn[];
}

interface EditorAppendRowsMessage extends EditorMessage {
    type: "appendRows";
    rows: SharkdRow[];
}

interface EditorSetRowsMessage extends EditorMessage {
    type: "setRows";
    rows: SharkdRow[];
}

interface EditorEnsureRowVisibleMessage extends EditorMessage {
    type: "ensureRowVisible";
    rowId: string;
}
