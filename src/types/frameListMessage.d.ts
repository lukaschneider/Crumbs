/* Messages from Frame List Instance to Frame List Webview */
interface FrameListInstanceMessage {
    type: "frameListInstanceReset" | "frameListInstanceFrames" | "frameListInstanceRevealFrame"
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

interface FrameListInstanceRevealFrameMessage extends FrameListInstanceMessage {
    type: "frameListInstanceRevealFrame"
    rowNodeId: string
}

/* Messages from Frame List Webview to Frame List Instance */
interface FrameListWebviewMessage {
    type: "frameListWebviewReady" | "frameListWebviewFrameFocused" | "frameListWebviewRevealFrameTree"
}

interface FrameListWebviewReadyMessage extends FrameListWebviewMessage {
    type: "frameListWebviewReady"
}

interface FrameListWebviewFrameFocusedMessage extends FrameListWebviewMessage {
    type: "frameListWebviewFrameFocused",
    frame: number
}

interface FrameListWebviewRevealFrameTreeMessage extends FrameListWebviewMessage {
    type: "frameListWebviewRevealFrameTree"
    rowNodeId: string
}
