import { describe, expect, it, vi } from "vitest";
import { resolveSharkdPath } from "../src/sharkdPath";

describe("sharkd discovery", () => {
  it("uses a standard Windows installation even if it is not on PATH", () => {
    const installed = "C:\\Program Files\\Wireshark\\sharkd.exe";
    for (const configured of [undefined, "", "  ", "sharkd"]) {
      expect(
        resolveSharkdPath(configured, {
          platform: "win32",
          env: {},
          exists: (path) => path === installed,
        }),
      ).toBe(installed);
    }
  });
  it("uses the system installation folders on non-C drives", () => {
    const installed = "D:\\Apps\\Wireshark\\sharkd.exe";
    expect(
      resolveSharkdPath("", {
        platform: "win32",
        env: {
          // biome-ignore lint/style/useNamingConvention: Windows environment variable name.
          ProgramW6432: "D:\\Apps",
        },
        exists: (path) => path === installed,
      }),
    ).toBe(installed);
  });
  it("falls back to the x86 installation and then PATH", () => {
    const installed = "C:\\Program Files (x86)\\Wireshark\\sharkd.exe";
    expect(
      resolveSharkdPath("", {
        platform: "win32",
        env: {},
        exists: (path) => path === installed,
      }),
    ).toBe(installed);
    expect(
      resolveSharkdPath("", {
        platform: "win32",
        env: {},
        exists: () => false,
      }),
    ).toBe("sharkd");
  });
  it("preserves custom executables and leaves other operating systems on PATH", () => {
    const exists = vi.fn(() => true);
    for (const path of [
      "D:\\Custom Wireshark\\sharkd.exe",
      "/opt/wireshark/sharkd",
      "custom-sharkd",
    ]) {
      expect(resolveSharkdPath(path, { platform: "win32", exists })).toBe(path);
    }
    expect(resolveSharkdPath("", { platform: "linux", exists })).toBe("sharkd");
    expect(resolveSharkdPath("", { platform: "darwin", exists })).toBe(
      "sharkd",
    );
    expect(exists).not.toHaveBeenCalled();
  });
});
