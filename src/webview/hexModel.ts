import type { ByteRange } from "../types/sharkd";

export const EMPTY_RANGE: ByteRange = [0, 0];

export function sameRange(a: ByteRange, b: ByteRange) {
  return a[0] === b[0] && a[1] === b[1];
}

export function getRangeAtIndex(index: number, ranges: ByteRange[]): ByteRange {
  if (index < 0) {
    return EMPTY_RANGE;
  }
  let smallest: ByteRange | undefined;
  for (const range of ranges) {
    if (
      range[1] > 0 &&
      index >= range[0] &&
      index < range[0] + range[1] &&
      (!smallest || range[1] < smallest[1])
    ) {
      smallest = range;
    }
  }
  return smallest ?? [index, 1];
}

export function normalizeLength(value: number, fallback: number) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 256
    ? value
    : fallback;
}

export function visibleRows(
  byteLength: number,
  rowLength: number,
  scrollTop: number,
  height: number,
  rowHeight: number,
) {
  const count = Math.ceil(byteLength / rowLength);
  const start = Math.min(
    Math.max(0, Math.floor(scrollTop / rowHeight) - 4),
    Math.max(0, count - 1),
  );
  const end = Math.min(count, Math.ceil((scrollTop + height) / rowHeight) + 4);
  return { start, end: Math.max(start, end), count };
}

export function clipRange(
  range: ByteRange,
  start: number,
  length: number,
): ByteRange {
  const left = Math.max(start, range[0]);
  const right = Math.min(start + length, range[0] + range[1]);
  return right > left ? [left, right - left] : EMPTY_RANGE;
}
