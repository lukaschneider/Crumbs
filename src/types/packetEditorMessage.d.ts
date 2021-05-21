/* Messages from Packet Editor Instance to Packet Editor Webview */
interface PacketEditorInstanceMessage {
    type: "packetEditorInstanceReset" | "packetEditorInstanceFrames"
}

interface PacketEditorInstanceResetMessage extends PacketEditorInstanceMessage {
    type: "packetEditorInstanceReset"
    columns: ConfigColumn[]
    colorCoding: boolean
}

interface PacketEditorInstanceFramesMessage extends PacketEditorInstanceMessage {
    type: "packetEditorInstanceFrames"
    frames: SharkdFrame[]
}

/* Messages from Packet Editor Webview to Packet Editor Instance */
interface PacketEditorWebviewMessage {
    type: "packetEditorWebviewReady"
}

interface PacketEditorWebviewReadyMessage extends PacketEditorWebviewMessage {
    type: "packetEditorWebviewReady"
}
