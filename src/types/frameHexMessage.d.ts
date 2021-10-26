/* Messages from Frame Hex Instance to Frame Hex Webview */
interface FrameHexInstanceMessage {
    type: "frameHexInstanceReset" | "frameHexInstanceSelect"
}

interface FrameHexInstanceSelectMessage extends FrameHexInstanceMessage {
    type: "frameHexInstanceSelect",
    byteRange: SharkdByteRange
}

interface FrameHexInstanceResetMessage extends FrameHexInstanceMessage {
    type: "frameHexInstanceReset",
    buffer: string,
    byteRanges: SharkdByteRange[],
    rowLength: number,
    setLength: number,
    enableRowWrap: boolean
}

/* Messages from Frame Hex Webview to Frame Hex Instance */
interface FrameHexWebviewMessage {
    type: "frameHexWebviewReady"
}

interface FrameHexWebviewReadyMessage extends FrameHexWebviewMessage {
    type: "frameHexWebviewReady"
}
