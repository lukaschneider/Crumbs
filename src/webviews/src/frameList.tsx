import React from "react"
import { ColumnApi, ColDef, GridApi, GridReadyEvent, RowNode } from "ag-grid-community"
import { AgGridReact } from "ag-grid-react"
import { zipObject } from "lodash"

import { vscodeApi } from "./vscodeApi"

import "ag-grid-community/dist/styles/ag-grid.css"
import "ag-grid-community/dist/styles/ag-theme-alpine.css"
import "./media/ag-theme-override.css"

export default class FrameList extends React.Component {
    private gridApi?: GridApi
    private columnApi?: ColumnApi

    private initialized: boolean = false

    private colorCoding: boolean = false
    
    render() {
        return (
            <div id="grid-root" className="ag-theme-alpine">
                <AgGridReact
                    asyncTransactionWaitMillis={250}
                    defaultColDef={{
                        resizable: true,
                        sortable: true,
                    }}
                    headerHeight={35}
                    onGridReady={this.initializeGrid.bind(this)}
                    rowHeight={30}
                    rowSelection={"multiple"}
                    getRowStyle={(node: RowNode) => {
                        return this.colorCoding ? {
                            "background-color": node.data.frameBackgrond, color: node.data.frameForeground
                        } : {};
                    }}
                    suppressColumnVirtualisation={true}
                    suppressDragLeaveHidesColumns={true}
                    suppressLoadingOverlay={true}
                    suppressNoRowsOverlay={true}
                />
            </div>
        )
    }

    private initializeGrid(params: GridReadyEvent) {
        this.gridApi = params.api
        this.columnApi = params.columnApi

        window.addEventListener("message", this.onMessage.bind(this))

        const message: FrameListWebviewReadyMessage = { type: "frameListWebviewReady" }
        vscodeApi.postMessage(message)
    }

    private reset(message: FrameListInstanceResetMessage) {
        this.initialized = false;

        this.gridApi?.flushAsyncTransactions()

        this.gridApi?.setRowData([])
        this.gridApi?.setColumnDefs([])

        this.colorCoding = message.colorCoding

        this.gridApi?.setColumnDefs(
            message.columns.map((column) => {
                return {
                    field: column.title
                        || column?.field.replace(".", " ")
                        || "Undefined",
                    hide: column.hidden,
                    pinned: column.pinned,
                }
            }))
    }

    private addFrames(message: FrameListInstanceFramesMessage) {
        this.gridApi?.applyTransactionAsync({
            add: message.frames.map(frame => {
                return {
                    frameNumber: frame.num,
                    frameBackgrond: "#" + frame.bg,
                    frameForeground: "#" + frame.fg,
                    ...zipObject(
                        this.gridApi!.getColumnDefs().map((columnDef: ColDef) => columnDef.field || "Undefined"),
                        frame.c.map(field => {
                            const numValue = parseFloat(field)
                            // @ts-ignore
                            return numValue == field ? numValue : field
                        })
                    ),
                }
            })
        })

        if (!this.initialized) {
            this.initialized = true;
            this.gridApi?.flushAsyncTransactions()
            this.columnApi?.autoSizeAllColumns()
        }
    }

    private onMessage(message: MessageEvent<FrameListInstanceMessage>) {
        switch (message.data.type) {
            case "frameListInstanceReset":
                this.reset(message.data as FrameListInstanceResetMessage)
                break
            case "frameListInstanceFrames":
                this.addFrames(message.data as FrameListInstanceFramesMessage)
                break
        }
    }
}
