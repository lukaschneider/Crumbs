import React from "react"
import { render } from "react-dom"

import FrameList from "./frameList"

document.addEventListener("DOMContentLoaded", () => {
    render(
        <React.StrictMode>
            <FrameList />
        </React.StrictMode>,
        document.getElementById("root")
    )
})
