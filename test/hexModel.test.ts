import { describe, expect, it } from "vitest";
import {
  clipRange,
  getRangeAtIndex,
  normalizeLength,
  visibleRows,
} from "../src/webview/hexModel";

describe("hex ranges", () => {
  it("chooses by length, not length minus offset", () => {
    expect(
      getRangeAtIndex(90, [
        [80, 20],
        [89, 4],
        [90, 10],
      ]),
    ).toEqual([89, 4]);
    expect(
      getRangeAtIndex(93, [
        [89, 4],
        [90, 10],
      ]),
    ).toEqual([90, 10]);
    expect(getRangeAtIndex(100, [[90, 10]])).toEqual([100, 1]);
    expect(getRangeAtIndex(-1, [])).toEqual([0, 0]);
  });
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 257])(
    "rejects unsafe row/group sizes: %s",
    (value) => {
      expect(normalizeLength(value, 16)).toBe(16);
    },
  );
  it("clips huge protocol ranges without allocating a set per byte", () => {
    expect(clipRange([0, 1_000_000_000], 16, 16)).toEqual([16, 16]);
    expect(clipRange([0, 8], 16, 16)).toEqual([0, 0]);
  });
  it("bounds the visible window for large packets and final partial rows", () => {
    const window = visibleRows(1_000_000, 16, 48_000, 600, 24);
    expect(window.end - window.start).toBeLessThanOrEqual(33);
    expect(window.count).toBe(62500);
    expect(visibleRows(17, 16, 0, 600, 24)).toEqual({
      start: 0,
      end: 2,
      count: 2,
    });
    expect(visibleRows(0, 16, 0, 600, 24).count).toBe(0);
  });
});
