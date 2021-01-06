import { Grid, GridOptions, GridApi, ColDef, ColumnApi } from "ag-grid-community";
import { zipObject } from "lodash";

// @ts-ignore
const vscode = acquireVsCodeApi();

class Editor {
    // @ts-ignore
    private api: GridApi;
    // @ts-ignore
    private columnApi: ColumnApi;

    constructor(columns: Column[]) {
        const postError = () => postMessage("error", "Failed to initialize editor.");

        const gridDiv = document.querySelector<HTMLElement>("#grid");
        if (!gridDiv) {
            postError();
            return;
        }

        const gridOptions: GridOptions = {
            rowSelection: "multiple",
            defaultColDef: {
                resizable: true,
                sortable: true,
            },
            getRowStyle: (params: any) => {
                return { "background-color": "#" + params.data.bg, color: "#" + params.data.fg };
            },
            columnDefs: columns.map((column) => {
                return { field: this.getColumnTitle(column) };
            }),
        };
        new Grid(gridDiv, gridOptions);

        if (!gridOptions.api || !gridOptions.columnApi) {
            postError();
            return;
        }
        this.api = gridOptions.api;
        this.columnApi = gridOptions.columnApi;
    }

    private getColumnTitle(column: Column): string {
        if (column.title) {
            return column.title;
        } else if (column.field) {
            return column.field.replace(".", " ");
        } else {
            return "Undefined";
        }
    }

    private columnFramesToRowData(columnFrames: ColumnFrame[]) {
        // I know this is hacky AF...
        const ensureType = (value: string) => {
            const numValue = parseFloat(value);

            // @ts-ignore
            if (numValue == value) {
                return numValue;
            } else {
                return value;
            }
        };

        return columnFrames.map((columnFrame) => {
            const rowData = zipObject(
                this.api.getColumnDefs().map((colDef: ColDef) => {
                    return colDef.field || "No Title";
                }),
                columnFrame.c.map((value: string) => ensureType(value)),
            );

            rowData.bg = columnFrame.bg;
            rowData.fg = columnFrame.fg;

            return rowData;
        });
    }

    setFrames(columnFrames: ColumnFrame[]) {
        this.api.setRowData(this.columnFramesToRowData(columnFrames));
    }

    appendFrames(columnFrames: ColumnFrame[]) {
        this.api.applyTransaction({ add: this.columnFramesToRowData(columnFrames) });
    }

    resizeColumns() {
        this.columnApi.autoSizeAllColumns();
    }
}

let editor: Editor;

const postMessage = (type: string, body: any) => {
    const message: Message<any> = { type, body };
    vscode.postMessage(message);
};

document.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage({ type: "ready" });
});

window.addEventListener("message", async (message: { data: Message<any> }) => {
    const { type, body } = message.data;

    switch (type) {
        case "init":
            editor = new Editor(body.columns);
            editor.setFrames(body.columnFrames);
            editor.resizeColumns();
            break;
        case "appendFrames":
            editor.appendFrames(body);
    }
});
