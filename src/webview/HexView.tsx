import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { TypedJSONRPCServerAndClient } from "json-rpc-2.0";
import type {
  FrameHexMethods,
  FrameHexWebviewMethods,
  FrameUpdate,
  InitResponse,
} from "../types/frameHex";
import type { ByteRange } from "../types/sharkd";
import { EmptyState } from "./EmptyState";
import {
  clipRange,
  EMPTY_RANGE,
  getRangeAtIndex,
  normalizeLength,
  sameRange,
  visibleRows,
} from "./hexModel";

type Rpc = TypedJSONRPCServerAndClient<FrameHexWebviewMethods, FrameHexMethods>;
type Config = Pick<InitResponse, "rowLength" | "setLength" | "enableRowWrap">;
const DEFAULT_CONFIG: Config = {
  rowLength: 16,
  setLength: 8,
  enableRowWrap: true,
};
const EMPTY_BUFFER = new Uint8Array();
const CELL_WIDTH = 22;
const GROUP_GAP = 22;
const PADDING_LEFT = 16;
const PADDING_RIGHT = GROUP_GAP;
// Start at the view's content edge, like the native protocol tree.
const PADDING_TOP = 0;
const PADDING_BOTTOM = 12;

interface RowProps {
  buffer: Uint8Array;
  start: number;
  rowLength: number;
  setLength: number;
  rowHeight: number;
  offsetWidth: number;
  wrap: boolean;
  selectedStart: number;
  selectedLength: number;
  hoveredStart: number;
  hoveredLength: number;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
}

const HexRow = memo(function HexRow(props: RowProps) {
  const {
    buffer,
    start,
    rowLength,
    setLength,
    rowHeight,
    wrap,
    onHover,
    onSelect,
  } = props;
  const fields = (ascii: boolean) =>
    Array.from({ length: rowLength }, (_, offset) => {
      const index = start + offset;
      const byte = buffer[index];
      const groupEnd =
        (offset + 1) % setLength === 0 && offset + 1 !== rowLength;
      if (index >= buffer.length) {
        return (
          <span
            className="hex-field"
            key={index}
            style={{ marginRight: groupEnd ? GROUP_GAP : 0 }}
          />
        );
      }
      const selected =
        index >= props.selectedStart &&
        index < props.selectedStart + props.selectedLength;
      const hovered =
        !selected &&
        index >= props.hoveredStart &&
        index < props.hoveredStart + props.hoveredLength;
      const printable = byte >= 32 && byte <= 126;
      return (
        <button
          aria-label={`${ascii ? "ASCII" : "Hex"} byte ${index}: ${byte.toString(16).padStart(2, "0")}`}
          aria-pressed={selected}
          className={`hex-field ${selected ? "selected" : hovered ? "hovered" : ""} ${ascii && !printable ? "deemphasized" : ""}`}
          data-byte-index={index}
          key={index}
          onClick={() => onSelect(index)}
          onFocus={() => onHover(index)}
          onMouseEnter={() => onHover(index)}
          style={{ marginRight: groupEnd ? GROUP_GAP : 0 }}
          type="button"
        >
          {ascii
            ? printable
              ? String.fromCharCode(byte)
              : "·"
            : byte.toString(16).padStart(2, "0")}
        </button>
      );
    });
  return (
    <div
      className="hex-row"
      data-row={start / rowLength}
      style={{
        top: PADDING_TOP + (start / rowLength) * rowHeight,
        height: rowHeight,
      }}
    >
      <span className="hex-offset" style={{ width: props.offsetWidth }}>
        {start.toString(16).padStart(4, "0").toUpperCase()}
      </span>
      <div className={wrap ? "hex-values wrap" : "hex-values"}>
        <div className="hex-bytes">{fields(false)}</div>
        <div className="hex-ascii">{fields(true)}</div>
      </div>
    </div>
  );
});

const styles = `
.hex-view { height: 100%; overflow: auto; position: relative; font-family: var(--vscode-editor-font-family, monospace); font-size: var(--vscode-editor-font-size, 13px); }
.hex-row { position: absolute; display: flex; left: ${PADDING_LEFT}px; }
.hex-offset { flex: none; margin-right: ${GROUP_GAP}px; text-align: right; line-height: 24px; color: var(--vscode-editorLineNumber-foreground); }
.hex-offset-ruler { position: absolute; visibility: hidden; white-space: pre; pointer-events: none; }
.hex-values { display: flex; column-gap: ${GROUP_GAP}px; }
.hex-values.wrap { flex-direction: column; }
.hex-bytes, .hex-ascii { display: flex; height: 24px; flex-shrink: 0; }
.hex-field { box-sizing: border-box; display: inline-block; width: ${CELL_WIDTH}px; min-width: ${CELL_WIDTH}px; height: 24px; padding: 0; border: 0; border-radius: 0; background: transparent; color: inherit; font: inherit; line-height: 24px; text-align: center; }
button.hex-field { cursor: pointer; }
.hex-field:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
.hex-field.deemphasized { color: var(--vscode-list-deemphasizedForeground); }
.hex-field.hovered { background: var(--vscode-list-hoverBackground); color: var(--vscode-list-hoverForeground); }
.hex-field.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
`;

export function HexView({ rpc }: { rpc: Rpc }) {
  const [buffer, setBuffer] = useState(EMPTY_BUFFER);
  const [hasFrame, setHasFrame] = useState(false);
  const [ranges, setRanges] = useState<ByteRange[]>([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [selected, setSelected] = useState<ByteRange>(EMPTY_RANGE);
  const [hovered, setHovered] = useState<ByteRange>(EMPTY_RANGE);
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState({
    width: 800,
    height: 600,
    top: 0,
    offsetWidth: 32,
  });
  const container = useRef<HTMLElement>(null);
  const offsetRuler = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let active = true;
    let revision = -1;
    let liveConfig = false;
    const update = (message: FrameUpdate) => {
      if (!active || message.revision <= revision) {
        return;
      }
      revision = message.revision;
      const bytes = message.frame ? atob(message.frame.bytes) : "";
      setHasFrame(message.frame !== null);
      setBuffer(Uint8Array.from(bytes, (byte) => byte.charCodeAt(0)));
      setRanges(message.frame?.byteRanges ?? []);
      setSelected(EMPTY_RANGE);
      setHovered(EMPTY_RANGE);
      setError("");
      if (container.current) {
        container.current.scrollTop = 0;
      }
      setViewport((previous) => ({ ...previous, top: 0 }));
    };
    const configure = (settings: Config) => {
      if (!active) {
        return;
      }
      setConfig({
        ...settings,
        rowLength: normalizeLength(settings.rowLength, 16),
        setLength: normalizeLength(settings.setLength, 8),
      });
    };
    rpc.addMethod("frame", update);
    rpc.addMethod("focus", ({ byteRange }) =>
      setSelected((previous) =>
        sameRange(previous, byteRange) ? previous : byteRange,
      ),
    );
    rpc.addMethod("config", (settings) => {
      liveConfig = true;
      configure(settings);
    });
    Promise.resolve(rpc.request("init"))
      .then((settings) => {
        if (!liveConfig) {
          configure(settings);
        }
        update(settings);
      })
      .catch((reason) => {
        if (active) {
          setError(String(reason));
        }
      });
    return () => {
      active = false;
      rpc.removeMethod("frame");
      rpc.removeMethod("focus");
      rpc.removeMethod("config");
    };
  }, [rpc]);

  useEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    const measure = () =>
      setViewport((previous) => {
        const width = element.clientWidth || 800;
        const height = element.clientHeight || 600;
        const offsetWidth =
          offsetRuler.current?.getBoundingClientRect().width || 32;
        return previous.width === width &&
          previous.height === height &&
          previous.offsetWidth === offsetWidth
          ? previous
          : { ...previous, width, height, offsetWidth };
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (offsetRuler.current) {
      observer.observe(offsetRuler.current);
    }
    return () => observer.disconnect();
  }, []);

  const { rowLength, setLength } = config;
  const offsetDigits = Math.max(
    4,
    Math.max(0, buffer.length - 1).toString(16).length,
  );
  const columnWidth =
    rowLength * CELL_WIDTH +
    Math.floor((rowLength - 1) / setLength) * GROUP_GAP;
  const sideWidth =
    PADDING_LEFT + viewport.offsetWidth + GROUP_GAP + PADDING_RIGHT;
  const wrap =
    config.enableRowWrap &&
    viewport.width < sideWidth + columnWidth * 2 + GROUP_GAP;
  const rowHeight = wrap ? 48 : 24;
  const rowWindow = visibleRows(
    buffer.length,
    rowLength,
    Math.max(0, viewport.top - PADDING_TOP),
    viewport.height,
    rowHeight,
  );
  const onHover = useCallback(
    (index: number) => {
      const next = getRangeAtIndex(index, ranges);
      setHovered((previous) => (sameRange(previous, next) ? previous : next));
    },
    [ranges],
  );
  const onSelect = useCallback(
    (index: number) => {
      const next = getRangeAtIndex(index, ranges);
      setSelected((previous) => (sameRange(previous, next) ? previous : next));
      void Promise.resolve(rpc.request("focus", { byteRange: next })).catch(
        (reason) => setError(String(reason)),
      );
    },
    [ranges, rpc],
  );

  useEffect(() => {
    const element = container.current;
    if (!element || selected[1] <= 0 || selected[0] >= buffer.length) {
      return;
    }
    const top = PADDING_TOP + Math.floor(selected[0] / rowLength) * rowHeight;
    if (
      top < element.scrollTop + PADDING_TOP ||
      top + rowHeight >
        element.scrollTop + (element.clientHeight || 600) - PADDING_BOTTOM
    ) {
      element.scrollTop = top - PADDING_TOP;
      setViewport((previous) => ({ ...previous, top: element.scrollTop }));
    }
  }, [selected, rowLength, rowHeight, buffer.length]);

  return (
    <>
      <style>{styles}</style>
      <section
        aria-label="Frame bytes"
        className="hex-view"
        data-vscode-context='{"preventDefaultContextMenuItems":true}'
        onMouseLeave={() => onHover(-1)}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          setViewport((previous) =>
            previous.top === top ? previous : { ...previous, top },
          );
        }}
        ref={container}
      >
        <span className="hex-offset-ruler" ref={offsetRuler} aria-hidden="true">
          {"0".repeat(offsetDigits)}
        </span>
        {error ? (
          <EmptyState
            icon="hex"
            compact
            alert
            title="Unable to show packet bytes"
            description="Select the packet again to retry."
            details={error}
          />
        ) : buffer.length === 0 ? (
          <EmptyState
            icon="hex"
            compact
            title={hasFrame ? "No bytes in this packet" : "No packet selected"}
            description={
              hasFrame
                ? "This packet has no captured bytes to display."
                : "Select a packet in the capture to inspect its bytes."
            }
          />
        ) : (
          <div
            style={{
              height:
                rowWindow.count * rowHeight + PADDING_TOP + PADDING_BOTTOM,
              position: "relative",
              minWidth:
                sideWidth +
                columnWidth * (wrap ? 1 : 2) +
                (wrap ? 0 : GROUP_GAP),
            }}
          >
            {Array.from(
              { length: rowWindow.end - rowWindow.start },
              (_, offset) => {
                const start = (rowWindow.start + offset) * rowLength;
                const selectedPart = clipRange(selected, start, rowLength);
                const hoveredPart = clipRange(hovered, start, rowLength);
                return (
                  <HexRow
                    buffer={buffer}
                    hoveredLength={hoveredPart[1]}
                    hoveredStart={hoveredPart[0]}
                    key={start}
                    onHover={onHover}
                    onSelect={onSelect}
                    offsetWidth={viewport.offsetWidth}
                    rowHeight={rowHeight}
                    rowLength={rowLength}
                    selectedLength={selectedPart[1]}
                    selectedStart={selectedPart[0]}
                    setLength={setLength}
                    start={start}
                    wrap={wrap}
                  />
                );
              },
            )}
          </div>
        )}
      </section>
    </>
  );
}
