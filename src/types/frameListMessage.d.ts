/* Messages from Frame List Instance to Frame List Webview */
interface FrameListInstanceMessage {
    type: "frameListInstanceReset" | "frameListInstanceFrames"
}

interface FrameListInstanceResetMessage extends FrameListInstanceMessage {
    type: "frameListInstanceReset"
    columns: ConfigColumn[]
    colorCoding: boolean
}

interface FrameListInstanceFramesMessage extends FrameListInstanceMessage {
    type: "frameListInstanceFrames"
    frames: SharkdFrame[]
}

/* Messages from Frame List Webview to Frame List Instance */
interface FrameListWebviewMessage {
    type: "frameListWebviewReady"
}

interface FrameListWebviewReadyMessage extends FrameListWebviewMessage {
    type: "frameListWebviewReady"
}
