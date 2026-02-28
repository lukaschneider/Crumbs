import {
  type CellDoubleClickedEvent,
  type CellFocusedEvent,
  ColumnAutoSizeModule,
  type FirstDataRenderedEvent,
  type GridReadyEvent,
  type IDatasource,
  type IGetRowsParams,
  InfiniteRowModelModule,
  type RowClassParams,
  RowSelectionModule,
  RowStyleModule,
  themeQuartz,
  ValidationModule,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
  type TypedJSONRPCServerAndClient,
} from "json-rpc-2.0";
import { zipObject } from "lodash";
import { StrictMode, useCallback } from "react";
import { createRoot } from "react-dom/client";
import type {
  FrameListMethods,
  FrameListWebviewMethods,
} from "../types/frameList";

// @ts-expect-error
const vscode = acquireVsCodeApi();

const rpc: TypedJSONRPCServerAndClient<
  FrameListWebviewMethods,
  FrameListMethods
> = new JSONRPCServerAndClient(
  new JSONRPCServer(),
  new JSONRPCClient((request) => {
    vscode.postMessage(request);
  }),
);

window.addEventListener("message", (message) => {
  rpc.receiveAndSend(message.data);
});

const FrameList = () => {
  const onGridReady = useCallback(async (params: GridReadyEvent) => {
    const init = await rpc.request("init");

    params.api.setGridOption(
      "columnDefs",
      init.columnHeaders.map((header) => {
        return { field: header, sortable: false };
      }),
    );

    const dataSource: IDatasource = {
      rowCount: init.numRows,
      getRows: async (params: IGetRowsParams) => {
        try {
          const frames = await rpc.request("frames", {
            startIndex: params.startRow,
            endIndex: params.endRow,
          });
          const rows = frames.frames.map((frame) => {
            return {
              frameBackground: init.colorCoding ? `#${frame.bg}` : undefined,
              frameForeground: init.colorCoding ? `#${frame.fg}` : undefined,
              ...zipObject(
                init.columnHeaders,
                frame.c.map((field) => {
                  const numValue = parseFloat(field);
                  // @ts-expect-error
                  // biome-ignore lint/suspicious/noDoubleEquals: Some trickery to have nicely formatted floats
                  return numValue == field ? numValue : field;
                }),
              ),
            };
          });
          params.successCallback(rows, init.numRows);
        } catch (err) {
          console.error(err);
          params.failCallback();
        }
      },
    };
    params.api.setGridOption("datasource", dataSource);
  }, []);

  return (
    <span>
      <style>
        {/* There are no theme overwrites for some foreground colors... */}
        {`
          .ag-row-hover .ag-cell-value {
            color: var(--vscode-editorActionList-foreground);
          }
          .ag-row-selected .ag-cell-value {
            color: var(--vscode-list-activeSelectionForeground);
          }
        `}
      </style>
      <AgGridReact
        cacheBlockSize={100}
        cacheOverflowSize={100}
        getRowStyle={(params: RowClassParams) => {
          try {
            return {
              backgroundColor: params.data.frameBackground,
              color: params.data.frameForeground,
            };
          } catch {}
        }}
        headerHeight={35}
        maxBlocksInCache={10}
        maxConcurrentDatasourceRequests={1}
        modules={[
          InfiniteRowModelModule,
          ValidationModule,
          RowStyleModule,
          ColumnAutoSizeModule,
          RowSelectionModule,
        ]}
        onCellDoubleClicked={async (params: CellDoubleClickedEvent) => {
          if (params.rowIndex == null) {
            return;
          }

          await rpc.request("focus", {
            frameId: params.rowIndex + 1,
            reveal: true,
          });
        }}
        onCellFocused={async (params: CellFocusedEvent) => {
          if (params.rowIndex == null) {
            return;
          }

          await rpc.request("focus", {
            frameId: params.rowIndex + 1,
            reveal: false,
          });
        }}
        onFirstDataRendered={(params: FirstDataRenderedEvent) => {
          params.api.autoSizeAllColumns();
        }}
        onGridReady={onGridReady}
        overlayComponentParams={{
          noRows: { overlayText: "No packets in capture file" },
        }}
        rowHeight={30}
        rowModelType="infinite"
        rowSelection={{
          mode: "multiRow",
          checkboxes: false,
          headerCheckbox: false,
          enableClickSelection: true,
        }}
        suppressDragLeaveHidesColumns={true}
        theme={themeQuartz.withParams({
          wrapperBorderRadius: 0,
          headerRowBorder: "1px var(--vscode-editorGroup-border) solid",
          headerColumnBorder: "1px var(--vscode-editorGroup-border) solid",
          headerColumnBorderHeight: "50%",
          iconColor: "var(--vscode-icon-foreground)",
          rowBorder: "var(--vscode-contrastBorder, transparent)",
          foregroundColor: "var(--vscode-editor-foreground)",
          backgroundColor: "var(--vscode-editor-background)",
          headerBackgroundColor: "var(--vscode-editorPane-background)",
          borderColor: "transparent",
          rowHoverColor: "var(--vscode-editorActionList-background)",
          selectedRowBackgroundColor:
            "var(--vscode-list-activeSelectionBackground)",
          rangeSelectionBorderColor: "var(--vscode-list-focusOutline)",
          oddRowBackgroundColor: "var(--vscode-tree-tableOddRowsBackground)",
          headerFontFamily: "var(--vscode-font-family)",
          headerFontSize: "var(--vscode-font-size)",
          fontFamily: "var(--vscode-editor-font-family)",
          fontSize: "var(--vscode-editor-font-size)",
        })}
      />
    </span>
  );
};

document.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("root");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <FrameList />
      </StrictMode>,
    );
  }
});
