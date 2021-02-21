import {
    CellFocusedEvent,
    CellKeyPressEvent,
    ColDef,
    ColumnApi,
    Grid,
    GridApi,
    GridOptions,
    RowClickedEvent,
    RowDoubleClickedEvent,
    RowNode,
} from "ag-grid-community";
import { zipObject } from "lodash";

class Editor {
    private api: GridApi;
    private columnApi: ColumnApi;
    private vscode: any;

    private coloredRows?: boolean;

    constructor() {
        this.coloredRows = false;

        const gridDiv = <HTMLElement>document.querySelector("#grid");
        const gridOptions: GridOptions = {
            defaultColDef: {
                resizable: true,
                sortable: true,
                lockPinned: true,
            },
            rowHeight: 30,
            headerHeight: 35,
            rowSelection: "multiple",
            suppressLoadingOverlay: true,
            suppressColumnVirtualisation: true,
            getRowStyle: (node: RowNode) => {
                return this.coloredRows ? { "background-color": node.data.bg, color: node.data.fg } : {};
            },
            onRowClicked: this.onRowClicked.bind(this),
            onRowDoubleClicked: this.onRowDoubleClicked.bind(this),
            onCellKeyPress: this.onCellKeyPress.bind(this),
            onCellFocused: this.onCellFocused.bind(this),
        };

        new Grid(gridDiv, gridOptions);

        this.api = <GridApi>gridOptions.api;
        this.columnApi = <ColumnApi>gridOptions.columnApi;

        window.addEventListener("message", this.onMessage.bind(this));

        // @ts-ignore
        this.vscode = acquireVsCodeApi();
        this.postMessage<WebviewReadyMessage>({ type: "ready" });
    }

    private onMessage({ data }: { data: EditorMessage }) {
        switch (data.type) {
            case "setColumns":
                this.api.setColumnDefs(this.createColumnDefs((data as EditorSetColumnsMessage).body));
                break;
            case "appendRows":
                this.appendRows((data as EditorAppendRowsMessage).rows);
                break;
            case "setRows":
                this.coloredRows = (data as EditorSetRowsMessage).colored;
                this.api.setRowData(this.rowsToRowNodes((data as EditorSetRowsMessage).rows));
                this.columnApi.autoSizeAllColumns();
                break;
            case "ensureRowVisible":
                this.api.ensureNodeVisible(this.api.getRowNode((data as EditorEnsureRowVisibleMessage).rowId));
        }
    }

    private postMessage<MessageType>(message: MessageType) {
        this.vscode.postMessage(message);
    }

    private onRowClicked(event: RowClickedEvent) {
        this.postMessage<WebviewSetFrameTreeMessage>({ type: "setFrameTree", frameNumber: event.data.crumbsFrameNumber });
    }

    private onRowDoubleClicked(event: RowDoubleClickedEvent) {
        this.postMessage<WebviewfocusFrameTreeMessage>({ type: "focusFrameTree", rowId: event.node.id as string });
    }

    private onCellKeyPress(event: CellKeyPressEvent) {
        const kEvent = <KeyboardEvent>event.event;
        switch (kEvent.key) {
            case "Enter":
                this.postMessage<WebviewSetFrameTreeMessage>({
                    type: "setFrameTree",
                    frameNumber: event.data.crumbsFrameNumber,
                });
                this.postMessage<WebviewfocusFrameTreeMessage>({ type: "focusFrameTree", rowId: event.node.id as string });
        }
    }

    private onCellFocused(event: CellFocusedEvent) {
        this.postMessage<WebviewSetFrameTreeMessage>({
            type: "setFrameTree",
            frameNumber: this.api.getDisplayedRowAtIndex(event.rowIndex || 0)?.data.crumbsFrameNumber,
        });
    }

    private rowsToRowNodes(rows: SharkdRow[]) {
        // This makes sure sorting works properly.
        const tryCastToNumber = (strValue: string) => {
            const numValue = parseFloat(strValue);

            // @ts-ignore
            if (numValue == strValue) {
                return numValue;
            } else {
                return strValue;
            }
        };

        return rows.map((row) => {
            let rowNodeData = zipObject(
                this.api.getColumnDefs().map((colDef: ColDef) => {
                    return colDef.field || "";
                }),
                row.c.map((field: string) => tryCastToNumber(field)),
            );

            // This field is used to set the Frame Tree View
            rowNodeData.crumbsFrameNumber = row.num;

            // Row colouring
            rowNodeData.bg = "#" + row.bg;
            rowNodeData.fg = "#" + row.fg;

            return rowNodeData;
        });
    }

    private createColumnDefs(columns?: CrumbsConfigColumn[]) {
        if (!columns) {
            return [];
        }

        return columns.map(
            (column): ColDef => {
                return { field: column.title || (column.field ? column.field.replace(".", " ") : "") };
            },
        );
    }

    private appendRows(rows: SharkdRow[]) {
        this.api.applyTransaction({ add: this.rowsToRowNodes(rows) });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new Editor();
});
