import { ColDef, ColumnApi, Grid, GridApi, GridOptions, RowNode } from "ag-grid-community";
import { zipObject } from "lodash";

class Editor {
    private api: GridApi;
    private columnApi: ColumnApi;
    private vscode: any;

    constructor() {
        const gridDiv = <HTMLElement>document.querySelector("#grid");
        const gridOptions: GridOptions = {
            defaultColDef: { resizable: true, sortable: true },
            getRowStyle: (row: RowNode) => {
                return { background: row.data.bg, color: row.data.fg };
            },
            rowSelection: "multiple",
            suppressLoadingOverlay: true,
        };

        new Grid(gridDiv, gridOptions);

        this.api = <GridApi>gridOptions.api;
        this.columnApi = <ColumnApi>gridOptions.columnApi;

        window.addEventListener("message", this.onMessage.bind(this));

        // @ts-ignore
        this.vscode = acquireVsCodeApi();
        this.vscode.postMessage({ type: "ready" });
    }

    private onMessage({ data }: { data: EditorMessage }) {
        switch (data.type) {
            case "setColumns":
                this.api.setColumnDefs(this.createColumnDefs((data as EditorSetColumnsMessage).body));
                break;
            case "appendRows":
                this.appendRows((data as EditorAppendRowsMessage).body);
                break;
            case "setRows":
                this.api.setRowData(this.rowsToRowNodes((data as EditorSetRowsMessage).body));
                this.columnApi.autoSizeAllColumns();
                break;
        }
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

            rowNodeData.bg = `#${row.bg}`;
            rowNodeData.fg = `#${row.fg}`;

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
