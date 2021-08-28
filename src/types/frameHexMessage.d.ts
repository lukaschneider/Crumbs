/* Messages from Frame Hex Instance to Frame Hex Webview */
interface FrameHexInstanceMessage {
    type: "frameHexInstanceSetBuffer"
}

interface FrameHexInstanceSetBufferMessage extends FrameHexInstanceMessage {
    type: "frameHexInstanceSetBuffer",
    buffer: string
}

/* Messages from Frame Hex Webview to Frame Hex Instance */
interface FrameHexWebviewMessage {
    type: "frameHexWebviewReady"
}

interface FrameHexWebviewReadyMessage extends FrameHexWebviewMessage {
    type: "frameHexWebviewReady"
}
