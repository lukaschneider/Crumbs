import React from "react"
import classNames from "classnames"

import { vscodeApi } from "../../vscodeApi"

import "./media/frameHex.css"

interface FrameHexProps {

}

interface FrameHexState {
    buffer: string
}

export default class FrameHex extends React.Component<FrameHexProps, FrameHexState> {
    constructor(props: FrameHexProps) {
        super(props)

        this.state = {
            buffer: ""
        }
    }

    componentDidMount() {
        window.addEventListener("message", this.onMessage.bind(this))

        const message: FrameHexWebviewReadyMessage = { type: "frameHexWebviewReady" }
        vscodeApi.postMessage(message)
    }

    render() {
        const bytes = Buffer.from(this.state.buffer, "base64").subarray()

        if (bytes.length === 0) {
            return <p>Click on a row in the Frame List to see the frame hex.</p>
        }

        const rowLength = 16
        const setLength = 8

        let rows: number[][] = []

        for (const key in bytes) {
            if (Object.prototype.hasOwnProperty.call(bytes, key)) {
                const byte = bytes[key];
                const index = parseInt(key)

                if ((index % rowLength) == 0) {
                    rows.push([])
                }
                
                if ((index % setLength) == 0) {
                    rows[rows.length - 1].push(-1)
                }

                rows[rows.length - 1].push(byte)
            }
        }

        return <table>{
            rows.map((row, index) => {
                const heading = ("0000" + rowLength * index).slice(-4)
                return <Row heading={heading}>{row}</Row>
            })
        }</table>
    }

    private onMessage(message: MessageEvent<FrameHexInstanceMessage>) {
        switch (message.data.type) {
            case "frameHexInstanceSetBuffer":
                this.setState({ buffer: (message.data as FrameHexInstanceSetBufferMessage).buffer })
                break;
        }
    }
}

interface RowProps {
    heading: string
    children: number[]
}

class Row extends React.Component<RowProps, {}> {

    render() {
        const { heading, children } = this.props

        const hexFields = children.map(value => <HexField>{value}</HexField>)
        const asciiFields = children.map(value => <AsciiField>{value}</AsciiField>)

        // Todo: Make interactive
        const rowClass = classNames({
        })

        const headingClass = classNames({
        })

        const hexFieldsClass = classNames({
        })

        const asciiFieldsClass = classNames({
        })

        return (
            <tr className={rowClass}>
                <td className={headingClass}>{heading}</td>
                <td className={hexFieldsClass}>{hexFields}</td>
                <td className={asciiFieldsClass}>{asciiFields}</td>
            </tr>
        )
    }
}

interface HexFieldProps {
    children: number
}

class HexField extends React.Component<HexFieldProps, {}> {
    render() {
        const { children } = this.props

        let hex = ""

        if (children >= 0) {
            hex = ("00" + children.toString(16)).slice(-2)
        }

        const fieldClass = classNames({field: true})

        return <div className={fieldClass}>{hex}</div>
    }
}

interface AsciiFieldProps {
    children: number
}

class AsciiField extends React.Component<AsciiFieldProps, {}> {
    render() {
        const { children } = this.props

        let ascii = "·"

        if (children < 0) {
            ascii = ""
        } else if (children > 31 && children < 127) {
            ascii = String.fromCharCode(children)
        }

        const fieldClass = classNames({field: true})

        return <div className={fieldClass}>{ascii}</div>
    }
}
