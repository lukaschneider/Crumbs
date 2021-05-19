import React from "react"
import { render } from "react-dom"

import PacketEditor from "./packetEditor"

document.addEventListener("DOMContentLoaded", () => {
    render(
        <React.StrictMode>
            <PacketEditor />
        </React.StrictMode>,
        document.getElementById("root")
    )
})
