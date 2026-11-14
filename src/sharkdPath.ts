import { existsSync } from "node:fs";
import { win32 } from "node:path";

interface PathOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (path: string) => boolean;
}

/** Custom paths win; the default detects standard Windows installations. */
export function resolveSharkdPath(
  configured?: string,
  options: PathOptions = {},
) {
  const path = configured?.trim();
  if (path && path !== "sharkd") {
    return path;
  }
  if ((options.platform ?? process.platform) === "win32") {
    const env = options.env ?? process.env;
    const roots = new Set([
      env.ProgramW6432,
      env.ProgramFiles,
      env["ProgramFiles(x86)"],
      `${env.SystemDrive || "C:"}\\Program Files`,
      `${env.SystemDrive || "C:"}\\Program Files (x86)`,
    ]);
    for (const root of roots) {
      if (!root) {
        continue;
      }
      const candidate = win32.join(root, "Wireshark", "sharkd.exe");
      if ((options.exists ?? existsSync)(candidate)) {
        return candidate;
      }
    }
  }
  return "sharkd";
}
