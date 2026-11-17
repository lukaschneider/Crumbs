import {
  ColumnAutoSizeModule,
  InfiniteRowModelModule,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ScrollApiModule,
  themeQuartz,
  ValidationModule,
  type GridApi,
  type IDatasource,
  type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TypedJSONRPCServerAndClient } from "json-rpc-2.0";
import type {
  FrameListMethods,
  FrameListWebviewMethods,
  InitResponse,
} from "../types/frameList";
import type { FilterState } from "../types/displayFilter";
import { toGridRow, type GridRow } from "./frameListModel";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { type CaptureError, describeCaptureError } from "./captureError";

declare const process: { env: Record<string, string> };
type Rpc = TypedJSONRPCServerAndClient<
  FrameListWebviewMethods,
  FrameListMethods
>;
const modules = [
  RowApiModule,
  InfiniteRowModelModule,
  RowStyleModule,
  RowSelectionModule,
  ScrollApiModule,
  ColumnAutoSizeModule,
  ...(process.env.NODE_ENV === "production" ? [] : [ValidationModule]),
];
const theme = themeQuartz.withParams({
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
  // Paint complete row states below, without AG Grid blending a second overlay.
  rowHoverColor: "transparent",
  selectedRowBackgroundColor: "transparent",
  rangeSelectionBorderColor:
    "var(--vscode-list-focusOutline, var(--vscode-focusBorder))",
  oddRowBackgroundColor: "var(--vscode-tree-tableOddRowsBackground)",
  headerFontFamily: "var(--vscode-font-family)",
  headerFontSize: "var(--vscode-font-size)",
  fontFamily: "var(--vscode-editor-font-family)",
  fontSize: "var(--vscode-editor-font-size)",
});
const rowSelection = {
  mode: "multiRow",
  checkboxes: false,
  headerCheckbox: false,
  enableClickSelection: true,
} as const;
const navigationKeys: Record<string, string> = {
  h: "ArrowLeft",
  j: "ArrowDown",
  k: "ArrowUp",
  l: "ArrowRight",
};
const getRowStyle = ({ data }: RowClassParams<GridRow>) => ({
  // Let CSS choose a complete foreground/background pair for each row state.
  // Reset absent values as AG Grid can reuse rows when loading another page.
  "--crumbs-packet-background": data?.background ?? "initial",
  "--crumbs-packet-foreground": data?.foreground ?? "initial",
});

const rowStyles = `
.frame-list-grid .ag-row {
  --crumbs-row-background: var(--crumbs-packet-background, var(--vscode-editor-background));
  background-color: var(--vscode-editor-background);
  background-image: linear-gradient(var(--crumbs-row-background), var(--crumbs-row-background));
  color: var(--crumbs-packet-foreground, var(--vscode-editor-foreground));
}
.frame-list-grid .ag-row-odd {
  --crumbs-row-background: var(--crumbs-packet-background, var(--vscode-tree-tableOddRowsBackground, var(--vscode-editor-background)));
}
/* The grid's spacer after the last column must not hide the row highlight. */
.frame-list-grid .ag-row:not(.ag-header-row)::after {
  background-color: transparent;
}
/* Theme overlays are designed for the editor surface, not arbitrary packet
   colors. Composite each state once over that surface, across the entire row. */
.frame-list-grid .ag-row-hover {
  --crumbs-row-background: var(--vscode-list-hoverBackground, transparent);
  color: var(--vscode-list-hoverForeground, var(--vscode-editor-foreground));
  outline: 1px dashed var(--vscode-contrastActiveBorder, transparent);
  outline-offset: -1px;
}
.frame-list-grid .ag-row-selected {
  --crumbs-row-background: var(--vscode-list-activeSelectionBackground, var(--vscode-editor-selectionBackground, transparent));
  color: var(--vscode-list-activeSelectionForeground, var(--vscode-editor-foreground));
  outline: none;
  --ag-row-border-color: transparent;
}
/* Outline the selected block, not each row. ensureDomOrder keeps sibling
   selectors aligned with the displayed rows as the grid virtualizes them. */
.frame-list-grid .ag-row-selected::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 1px solid var(--vscode-contrastActiveBorder, currentColor);
  z-index: 2;
  pointer-events: none;
}
.frame-list-grid .ag-row-selected + .ag-row-selected::before {
  border-top-width: 0;
}
.frame-list-grid .ag-row-selected:has(+ .ag-row-selected)::before {
  border-bottom-width: 0;
}
.frame-list-grid:not(:focus-within) .ag-row-selected {
  --crumbs-row-background: var(--vscode-list-inactiveSelectionBackground, var(--vscode-editor-background));
  color: var(--vscode-list-inactiveSelectionForeground, var(--vscode-editor-foreground));
}
/* Pinned columns must use the same opaque surface without covering its tint. */
.frame-list-grid .ag-row > :is(.ag-grid-pinned-left-cells, .ag-grid-pinned-right-cells) {
  background: inherit;
}
.frame-list-grid .ag-row > :is(.ag-grid-pinned-left-cells, .ag-grid-pinned-right-cells) > .ag-grid-container-wrapper {
  background: transparent;
}
`;

export function FrameListView({ rpc }: { rpc: Rpc }) {
  const [error, setError] = useState<CaptureError | null>(null);
  const [init, setInit] = useState<InitResponse | null>(null);
  const [filter, setFilter] = useState<FilterState | null>(null);
  const filterRef = useRef(filter);
  const [api, setApi] = useState<GridApi<GridRow> | null>(null);
  const [ready, setReady] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const acceptFilter = useCallback((next: FilterState) => {
    if (filterRef.current && next.revision <= filterRef.current.revision) {
      return;
    }
    filterRef.current = next;
    setFilter(next);
    setReady(false);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retrying must reinitialize the same RPC connection.
  useEffect(() => {
    let active = true;
    rpc.addMethod("filter", acceptFilter);
    void Promise.resolve(rpc.request("init")).then(
      (result) => {
        if (!active) {
          return;
        }
        setInit(result);
        acceptFilter(result.filterState);
      },
      (reason) => {
        if (active) {
          setError(describeCaptureError(reason));
        }
      },
    );
    return () => {
      active = false;
      rpc.removeMethod("filter");
    };
  }, [rpc, attempt, acceptFilter]);
  useEffect(() => {
    if (!api || api.isDestroyed() || !init || !filter || !filter.numRows) {
      return;
    }
    let active = true;
    setReady(false);
    api.setGridOption(
      "columnDefs",
      init.columnHeaders.map((header, index) => ({
        headerName: header,
        colId: String(index),
        sortable: false,
        valueGetter: ({ data }) => data?.values[index],
      })),
    );
    const source: IDatasource = {
      rowCount: filter.numRows,
      getRows: async (params) => {
        try {
          const result = await rpc.request("frames", {
            startIndex: params.startRow,
            endIndex: params.endRow,
            revision: filter.revision,
          });
          if (
            !active ||
            api.isDestroyed() ||
            result.revision !== filterRef.current?.revision
          ) {
            return;
          }
          params.successCallback(
            result.frames.map((frame) => toGridRow(frame, init.colorCoding)),
            filter.numRows,
          );
          setReady(true);
        } catch (reason) {
          if (
            !active ||
            api.isDestroyed() ||
            filter.revision !== filterRef.current?.revision
          ) {
            return;
          }
          params.failCallback();
          setError(describeCaptureError(reason));
        }
      },
    };
    api.setGridOption("datasource", source);
    api.ensureIndexVisible(0, "top");
    return () => {
      active = false;
    };
  }, [api, init, filter, rpc]);
  const focus = (frameId: number | undefined, reveal: boolean) => {
    if (frameId === undefined || !ready || !filter) {
      return;
    }
    void Promise.resolve(
      rpc.request("focus", { frameId, reveal, revision: filter.revision }),
    ).catch((reason) => setError(describeCaptureError(reason)));
  };
  const retry = async () => {
    setRetrying(true);
    try {
      await rpc.request("retry");
      filterRef.current = null;
      setFilter(null);
      setInit(null);
      setApi(null);
      setReady(false);
      setAttempt((previous) => previous + 1);
      setError(null);
    } catch (reason) {
      setError(describeCaptureError(reason));
    } finally {
      setRetrying(false);
    }
  };
  const action = (request: PromiseLike<unknown>) => {
    void Promise.resolve(request).catch((reason) =>
      setError(describeCaptureError(reason)),
    );
  };
  if (error) {
    return (
      <EmptyState
        icon={error.icon}
        title={error.title}
        description={error.description}
        hint={error.hint}
        details={error.details}
        alert
        busy={retrying}
      >
        <button
          className="state-button"
          type="button"
          disabled={retrying}
          onClick={() => {
            void retry();
          }}
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
        {error.setting && (
          <button
            className="state-link"
            type="button"
            onClick={() =>
              action(
                rpc.request("openSettings", {
                  setting: error.setting ?? "sharkd",
                }),
              )
            }
          >
            Open settings
          </button>
        )}
        <button
          className="state-link"
          type="button"
          onClick={() => action(rpc.request("showLog"))}
        >
          Show log
        </button>
      </EmptyState>
    );
  }
  if (!init || !filter) {
    return (
      <EmptyState
        title="Opening capture…"
        description="Reading packet data with Wireshark."
        busy
      />
    );
  }
  return (
    <div
      data-vscode-context='{"preventDefaultContextMenuItems":true}'
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <style>{`
      ${rowStyles}
      .frame-count { flex: none; padding: 5px 12px; border-top: 1px solid var(--vscode-editorGroup-border); font: 12px var(--vscode-font-family); color: var(--vscode-descriptionForeground); }
    `}</style>
      <FilterBar
        rpc={rpc}
        state={filter}
        initialHistory={init.history}
        onApplied={acceptFilter}
      />
      <div style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 0 }}>
        {filter.numRows === 0 ? (
          <EmptyState
            icon={init.numRows === 0 ? "capture" : "no-matches"}
            title={
              init.numRows === 0
                ? "This capture is empty"
                : "No packets match this filter"
            }
            description={
              init.numRows === 0
                ? "There are no packets to display in this file."
                : "Edit or clear the display filter to show packets."
            }
          />
        ) : (
          <>
            {!ready && (
              <div style={{ position: "absolute", inset: 0 }}>
                <EmptyState
                  title="Loading packets…"
                  description="Reading packet data with Wireshark."
                  busy
                />
              </div>
            )}
            <div
              className="frame-list-grid"
              onKeyDownCapture={(event) => {
                const key = navigationKeys[event.key];
                if (
                  !key ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.nativeEvent.isComposing ||
                  !(event.target instanceof HTMLElement) ||
                  !event.target.matches('[role="gridcell"]')
                ) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                // Reuse grid navigation, including scrolling and virtual rows.
                event.target.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key,
                    code: key,
                    bubbles: true,
                    cancelable: true,
                    repeat: event.repeat,
                  }),
                );
              }}
              style={{
                height: "100%",
                visibility: ready ? "visible" : "hidden",
              }}
            >
              <AgGridReact<GridRow>
                key={attempt}
                ensureDomOrder
                cacheBlockSize={100}
                cacheOverflowSize={1}
                getRowId={({ data }) => String(data.id)}
                getRowStyle={getRowStyle}
                headerHeight={35}
                maxBlocksInCache={10}
                maxConcurrentDatasourceRequests={1}
                modules={modules}
                onCellDoubleClicked={(event) => focus(event.data?.id, true)}
                onCellKeyDown={(event) => {
                  const keyEvent = event.event as KeyboardEvent | undefined;
                  if (keyEvent?.key === "Enter" && !keyEvent.isComposing) {
                    keyEvent.preventDefault();
                    focus(event.data?.id, true);
                  }
                }}
                onCellFocused={(event) => {
                  if (event.rowIndex !== null && !event.rowPinned) {
                    focus(
                      event.api.getDisplayedRowAtIndex(event.rowIndex)?.data
                        ?.id,
                      false,
                    );
                  }
                }}
                onFirstDataRendered={(event) => event.api.autoSizeAllColumns()}
                onGridReady={(event) => setApi(event.api)}
                rowHeight={30}
                rowModelType="infinite"
                rowSelection={rowSelection}
                suppressDragLeaveHidesColumns
                theme={theme}
              />
            </div>
          </>
        )}
      </div>
      <div className="frame-count" aria-live="polite">
        {filter.numRows.toLocaleString()} of {init.numRows.toLocaleString()}{" "}
        packets{filter.filter ? " · Filter active" : ""}
      </div>
    </div>
  );
}
