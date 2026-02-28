/** biome-ignore-all lint/a11y: Please create an issue if there is a problem with accessibility */
/** biome-ignore-all lint/suspicious/noArrayIndexKey: ok... */

import classNames from "classnames";
import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
  type TypedJSONRPCServerAndClient,
} from "json-rpc-2.0";
import React, {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  FocusRequest,
  FrameHexMethods,
  FrameHexWebviewMethods,
  FrameRequest,
  InitResponse,
} from "../types/frameHex";
import type { ByteRange } from "../types/sharkd";

type Field = {
  byte?: number;
  byteIndex?: number;
  isPadding?: boolean;
  isSpacer?: boolean;
  hovered?: boolean;
  selected?: boolean;
};

// @ts-expect-error
const vscode = acquireVsCodeApi();

const rpc: TypedJSONRPCServerAndClient<
  FrameHexWebviewMethods,
  FrameHexMethods
> = new JSONRPCServerAndClient(
  new JSONRPCServer(),
  new JSONRPCClient((request) => {
    vscode.postMessage(request);
  }),
);

window.addEventListener("message", (message) => {
  rpc.receiveAndSend(message.data);
});

const getHexValue = (byte: number) => {
  if (byte >= 0) {
    return `00${byte.toString(16)}`.slice(-2);
  }
  return "";
};

const getAsciiValue = (byte: number) => {
  if (byte < 0) {
    return "";
  } else if (byte > 31 && byte < 127) {
    return String.fromCharCode(byte);
  }
  return "·";
};

const getIndexesFromRange = (range: ByteRange) => {
  const indexes: number[] = [];
  for (let index = range[0]; index < range[0] + range[1]; index++) {
    indexes.push(index);
  }
  return new Set(indexes);
};

const getRangeAtIndex = (index: number, byteRanges: ByteRange[]): ByteRange => {
  let range: ByteRange | undefined;

  byteRanges.forEach((x) => {
    if (index >= x[0] && index <= x[0] + x[1] - 1) {
      if (range === undefined || x[1] - x[0] < range[1] - range[0]) {
        range = x;
      }
    }
  });

  return range === undefined ? [0, 0] : range;
};

type FieldProps = {
  byte?: number;
  byteIndex?: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (index: number) => void;
  onMouseOver: (index: number) => void;
};

const Field = React.memo(
  ({
    byte,
    byteIndex,
    isSelected,
    isHovered,
    onClick,
    onMouseOver,
  }: FieldProps) => {
    const hexValue = getHexValue(byte ?? -1);

    return (
      <div
        className={classNames("field", {
          clickable: byteIndex !== undefined,
          hovered: isHovered,
          selected: isSelected,
        })}
        onClick={(e) => {
          e.stopPropagation();
          onClick(byteIndex ?? -1);
        }}
        onMouseOver={(e) => {
          e.stopPropagation();
          onMouseOver(byteIndex ?? -1);
        }}
      >
        {hexValue}
      </div>
    );
  },
);

type RowProps = {
  row: Field[];
  rowIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  rowLength: number;
  enableRowWrap: boolean;
};

const Row = React.memo(
  ({
    row,
    rowIndex,
    onSelect,
    onHover,
    rowLength,
    enableRowWrap,
  }: RowProps) => {
    return (
      <div className="container" key={`row-${rowIndex}`}>
        <div className="row-header">
          {(rowLength * rowIndex).toString(16).padStart(4, "0").toUpperCase()}
        </div>
        <div className={classNames("container", { "row-wrap": enableRowWrap })}>
          <div className="container hex-body">
            {row.map((field, fieldIndex) => {
              if (field.isSpacer || field.isPadding) {
                return (
                  <div className="field spacer" key={`hex-s-${fieldIndex}`} />
                );
              }
              return (
                <Field
                  byte={field.byte}
                  byteIndex={field.byteIndex}
                  isHovered={field.hovered ?? false}
                  isSelected={field.selected ?? false}
                  key={`hex-${fieldIndex}`}
                  onClick={onSelect}
                  onMouseOver={onHover}
                />
              );
            })}
          </div>
          <div className="container">
            {row.map((field, fieldIndex) => {
              if (field.isSpacer || field.isPadding) {
                return (
                  <div className="field spacer" key={`asc-s-${fieldIndex}`} />
                );
              }
              const ascii = getAsciiValue(field.byte ?? -1);
              return (
                <div
                  className={classNames("field", {
                    clickable: field.byteIndex !== undefined,
                    deemphasized: ascii === "·",
                    hovered: field.hovered,
                    selected: field.selected,
                  })}
                  key={`asc-${fieldIndex}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(field.byteIndex ?? -1);
                  }}
                  onMouseOver={(e) => {
                    e.stopPropagation();
                    onHover(field.byteIndex ?? -1);
                  }}
                >
                  {ascii}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

const FrameHex = () => {
  // Data State
  const [buffer, setBuffer] = useState<Uint8Array | null>(null);
  const [byteRanges, setByteRanges] = useState<ByteRange[]>([]);

  // Config State
  const [rowLength, setRowLength] = useState<number>(16);
  const [setLength, setSetLength] = useState<number>(8);
  const [enableRowWrap, setEnableRowWrap] = useState<boolean>(true);

  // UI State
  const [selectedRange, setSelectedRange] = useState<Set<number>>(new Set());
  const [hoveredRange, setHoveredRange] = useState<Set<number>>(new Set());

  useEffect(() => {
    rpc.addMethod("frame", (params: FrameRequest) => {
      setBuffer(params.buffer);
      setByteRanges([...params.byteRanges]);
    });

    rpc.addMethod("focus", (params: FocusRequest) => {
      if (params.byteRange && params.byteRange.length > 0) {
        setSelectedRange(getIndexesFromRange(params.byteRange));
      }
    });

    rpc.request("init").then((params: InitResponse) => {
      setRowLength(params.rowLength);
      setSetLength(params.setLength);
      setEnableRowWrap(params.enableRowWrap);
      if (params.frame) {
        setBuffer(params.frame.buffer);
        setByteRanges([...params.frame.byteRanges]);
      }
    });

    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", preventContextMenu);

    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  // Handlers
  const onHover = useCallback(
    (index: number) => {
      const range = getRangeAtIndex(index, byteRanges);
      setHoveredRange(getIndexesFromRange(range));
    },
    [byteRanges],
  );

  const onSelect = useCallback(
    (index: number) => {
      const range = getRangeAtIndex(index, byteRanges);
      setSelectedRange(getIndexesFromRange(range));
      rpc.request("focus", { byteRange: range });
    },
    [byteRanges],
  );

  const baseRows = useMemo(() => {
    if (!buffer || buffer.length === 0) {
      return [];
    }

    const rows: Field[][] = [];
    const totalBytes = buffer.length;

    // Iterate through the buffer in chunks of rowLength
    for (let rowStart = 0; rowStart < totalBytes; rowStart += rowLength) {
      const currentRow: Field[] = [];

      for (let j = 0; j < rowLength; j++) {
        const byteIndex = rowStart + j;

        if (byteIndex < totalBytes) {
          currentRow.push({
            byte: buffer[byteIndex],
            byteIndex: byteIndex,
          });
        } else {
          currentRow.push({ isPadding: true });
        }

        const isSetEnd = (j + 1) % setLength === 0;
        const isRowEnd = j + 1 === rowLength;

        if (isSetEnd && !isRowEnd) {
          currentRow.push({ isSpacer: true });
        }
      }
      rows.push(currentRow);
    }

    return rows;
  }, [buffer, rowLength, setLength]);

  // Apply highlights dynamically without rebuilding the whole layout
  const highlightedRows = useMemo(() => {
    return baseRows.map((row) =>
      row.map((field) => {
        if (field.byteIndex === undefined) {
          return field;
        }

        const isSelected = selectedRange.has(field.byteIndex);
        const isHovered = hoveredRange.has(field.byteIndex);

        return {
          ...field,
          hovered: isHovered && !isSelected,
          selected: isSelected,
        };
      }),
    );
  }, [baseRows, selectedRange, hoveredRange]);

  if (!buffer || buffer.length === 0) {
    return <p>Click on a row in the Frame List to see the frame hex.</p>;
  }

  return (
    <span>
      <style>
        {`
          .placeholder {
            font-family: var(--vscode-font-family);
          }
          .container {
            display: flex;
            cursor: default;
          }
          .row-wrap {
            flex-wrap: wrap;
          }
          .row-header {
            color: var(--vscode-editorLineNumber-foreground);
            margin-right: 22px;
          }
          .hex-body {
            margin-right: 22px;
          }
          .field {
            min-width: 22px;
            text-align: center;
          }
          .clickable {
            cursor: pointer;
          }
          .deemphasized {
            color: var(--vscode-list-deemphasizedForeground);
          }
          .hovered {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
          }
          .selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
          }
        `}
      </style>
      <span
        onClick={() => onSelect(-1)}
        onMouseLeave={() => onHover(-1)}
        onMouseOver={() => onHover(-1)}
      >
        {highlightedRows.map((row, rowIndex) => (
          <Row
            enableRowWrap={enableRowWrap}
            key={`row-${rowIndex}`}
            onHover={onHover}
            onSelect={onSelect}
            row={row}
            rowIndex={rowIndex}
            rowLength={rowLength}
          />
        ))}
      </span>
    </span>
  );
};

document.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("root");

  if (container) {
    createRoot(container).render(
      <StrictMode>
        <FrameHex />
      </StrictMode>,
    );
  }
});
