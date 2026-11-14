import type { FramesRequest } from "./types/sharkd";

export function framePage(startIndex: number, endIndex: number): FramesRequest {
  if (
    !Number.isSafeInteger(startIndex) ||
    !Number.isSafeInteger(endIndex) ||
    startIndex < 0 ||
    endIndex <= startIndex
  ) {
    throw new Error("Invalid frame range");
  }
  // sharkd rejects zero: omit skip entirely for the first page.
  return {
    ...(startIndex > 0 ? { skip: startIndex } : {}),
    limit: endIndex - startIndex,
  };
}
