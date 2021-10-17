import classNames from "classnames"
import React from "react"

import { vscodeApi } from "../../vscodeApi"

import "./media/frameHex.css"

export default class FrameHex extends React.Component<FrameHexProps, FrameHexState> {
    constructor(props: FrameHexProps) {
        super(props)

        this.state = {
            buffer: "",
            byteRanges: [],
            rowLength: 16,
            setLength: 8,
            enableRowWrap: true,
            selectedRange: [],
            hoveredRange: []
        }
    }

    componentDidMount() {
        window.addEventListener("message", this.onMessage.bind(this))

        const message: FrameHexWebviewReadyMessage = { type: "frameHexWebviewReady" }
        vscodeApi.postMessage(message)
    }

    render() {
        if (this.state.buffer.length === 0) {
            return <p>Click on a row in the Frame List to see the frame hex.</p>
        }

        const rows = this.setHightlights(this.getRows())

        return <div
            id="hex_view"
            onMouseOver={() => this.onHover(-1)}
            onMouseLeave={() => this.onHover(-1)}
            onClick={() => this.onSelect(-1)}
        >
            {
                rows.map((row, rowIndex) => {
                    return <div className="container">
                        <div className="row_header">{("0000" + this.state.rowLength * rowIndex).slice(-4)}</div>
                        <div className={classNames("container", { row_wrap: this.state.enableRowWrap })}>
                            <div className="container hex_body">
                                {
                                    row.map(field => {
                                        const hexValue = this.getHexValue(field.byte ?? -1)
                                        return <div
                                            className={
                                                classNames("field", {
                                                    clickable: field.byteIndex != undefined,
                                                    hovered: field.hovered,
                                                    selected: field.selected
                                                })
                                            }
                                            onMouseOver={(e) => {
                                                e.stopPropagation()
                                                this.onHover(field.byteIndex ?? -1)
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                this.onSelect(field.byteIndex ?? -1)
                                            }}
                                        >
                                            {hexValue}
                                        </div>
                                    })
                                }
                            </div>
                            <div className="container">
                                {
                                    row.map(field => {
                                        const asciiValue = this.getAsciiValue(field.byte ?? -1)
                                        return <div
                                            className={
                                                classNames("field", {
                                                    clickable: field.byteIndex != undefined,
                                                    deemphasized: asciiValue == "·",
                                                    hovered: field.hovered,
                                                    selected: field.selected
                                                })
                                            }
                                            onMouseOver={(e) => {
                                                e.stopPropagation()
                                                this.onHover(field.byteIndex ?? -1)
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                this.onSelect(field.byteIndex ?? -1)
                                            }}
                                        >
                                            {asciiValue}
                                        </div>
                                    })
                                }
                            </div>
                        </div>
                    </div>
                })
            }
        </div>
    }

    private setHightlights(rows: FrameHexRows) {
        return rows.map(row => row.map(field => {
            if (field.byteIndex == undefined) {
                return field
            }
            if (this.state.selectedRange.indexOf(field.byteIndex) !== -1) {
                return { ...field, hovered: false, selected: true }
            }
            else if (this.state.hoveredRange.indexOf(field.byteIndex) !== -1) {
                return { ...field, hovered: true, selected: false }
            }
            else {
                return { ...field, hovered: false, selected: false }
            }
        }))
    }

    private getHexValue(byte: number) {
        let hex = ""

        if (byte >= 0) {
            hex = ("00" + byte.toString(16)).slice(-2)
        }

        return hex
    }

    private getAsciiValue(byte: number) {
        let ascii = "·"

        if (byte < 0) {
            ascii = ""
        } else if (byte > 31 && byte < 127) {
            ascii = String.fromCharCode(byte)
        }

        return ascii
    }

    private getRows() {
        const bytes = Buffer.from(this.state.buffer, "base64").subarray()

        let rows: FrameHexRows = []
        let fieldIndexOffset = 0

        for (const key in bytes) {
            if (Object.prototype.hasOwnProperty.call(bytes, key)) {
                const byte = bytes[key]
                const byteIndex = parseInt(key)

                const getNextFieldIndex = () => byteIndex % this.state.rowLength + fieldIndexOffset

                // Push new row if rowLength was reached
                if ((byteIndex % this.state.rowLength) == 0) {
                    fieldIndexOffset = 0
                    rows.push([])
                }

                // Push new space to current row if setLength was reached
                if ((byteIndex % this.state.setLength) == 0 && (byteIndex % this.state.rowLength) != 0) {
                    rows[rows.length - 1].push({
                        fieldIndex: getNextFieldIndex()
                    })
                    fieldIndexOffset++
                }

                rows[rows.length - 1].push({
                    byte: byte,
                    byteIndex: byteIndex,
                    fieldIndex: getNextFieldIndex(),
                })
            }
        }

        // Fill last row to full rowLength
        for (let i = rows[rows.length - 1].length; i < rows[0].length; i++) {
            rows[rows.length - 1].push({ fieldIndex: i })
        }

        return rows
    }

    private getRelatedIndexes(index: number) {
        let range: number[] = []
        this.state.byteRanges.map(x => {
            // Check bounds
            if (index >= x[0] && index <= x[0] + x[1] - 1) {
                // Set lowest value
                if (x[1] - x[0] < range[1] - range[0] || range.length === 0) {
                    range = x
                }
            }
        })

        let indexes: number[] = []
        for (let index = range[0]; index < range[0] + range[1]; index++) {
            indexes.push(index)
        }
        return indexes
    }

    private onHover(index: number) {
        this.setState({
            hoveredRange: this.getRelatedIndexes(index)
        })
    }

    private onSelect(index: number) {
        this.setState({
            selectedRange: this.getRelatedIndexes(index)
        })
    }

    private onMessage(message: MessageEvent<FrameHexInstanceMessage>) {
        switch (message.data.type) {
            case "frameHexInstanceReset":
                this.setState({
                    buffer: (message.data as FrameHexInstanceResetMessage).buffer,
                    byteRanges: (message.data as FrameHexInstanceResetMessage).byteRanges,
                    rowLength: (message.data as FrameHexInstanceResetMessage).rowLength,
                    setLength: (message.data as FrameHexInstanceResetMessage).setLength,
                    enableRowWrap: (message.data as FrameHexInstanceResetMessage).enableRowWrap,
                })
        }
    }
}
