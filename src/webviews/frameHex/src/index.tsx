import React from "react"
import { render } from "react-dom"

import FrameHex from "./frameHex"

document.addEventListener("DOMContentLoaded", () => {
    render(
        <React.StrictMode>
            <FrameHex />
        </React.StrictMode>,
        document.getElementById("root")
    )
})
