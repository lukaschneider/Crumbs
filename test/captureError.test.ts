import { describe, expect, it } from "vitest";
import { describeCaptureError } from "../src/webview/captureError";
import { framePage } from "../src/framePaging";

describe("capture error guidance", () => {
  it.each([
    [
      "Failed to start sharkd: spawn sharkd ENOENT",
      "Wireshark couldn’t be found",
      "sharkd",
    ],
    [
      'Sharkd exited (1): Configuration profile "missing" does not exist',
      "Wireshark profile unavailable",
      "profile",
    ],
    [
      "Failed to start sharkd: timeout",
      "Wireshark took too long to start",
      "sharkd",
    ],
    ["EACCES: permission denied", "Access was denied", "sharkd"],
    [
      "Unknown frame list column format: %missing",
      "Check your packet columns",
      "frameList.columns",
    ],
  ])("explains %s and offers relevant settings", (message, title, setting) => {
    const error = describeCaptureError(new Error(message));
    expect(error.title).toBe(title);
    expect(error.setting).toBe(setting);
    expect(error.details).toBe(message);
    expect(error.hint).not.toBe("");
  });
  it("keeps unknown diagnostics without inventing a cause", () => {
    const error = describeCaptureError("backend error -1234");
    expect(error.title).toBe("Couldn’t load this capture");
    expect(error.details).toBe("backend error -1234");
    expect(error.setting).toBeUndefined();
  });
});

describe("sharkd paging", () => {
  it("omits skip on the first page and uses positive offsets thereafter", () => {
    expect(framePage(0, 100)).toEqual({ limit: 100 });
    expect(framePage(100, 200)).toEqual({ skip: 100, limit: 100 });
  });
  it.each([
    [0, 0],
    [-1, 1],
    [2, 1],
    [0.5, 2],
    [0, Number.NaN],
  ])("rejects invalid bounds %s..%s", (start, end) => {
    expect(() => framePage(start, end)).toThrow("Invalid frame range");
  });
});
