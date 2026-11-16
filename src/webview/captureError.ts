import type { EmptyStateIconKind } from "./EmptyStateIcon";

export interface CaptureError {
  icon: EmptyStateIconKind;
  title: string;
  description: string;
  hint: string;
  details: string;
  setting?: "sharkd" | "profile" | "frameList.columns";
}

export function describeCaptureError(error: unknown): CaptureError {
  const details = error instanceof Error ? error.message : String(error);
  if (/ENOENT|executable.*not found/i.test(details)) {
    return {
      icon: "missing",
      title: "Wireshark couldn’t be found",
      description: "Crumbs uses Wireshark’s sharkd to read packet captures.",
      hint: "Install Wireshark, or choose the sharkd executable in settings. Standard Windows installations are detected automatically.",
      details,
      setting: "sharkd",
    };
  }
  if (
    /profile/i.test(details) &&
    /not|missing|unknown|invalid|no such/i.test(details)
  ) {
    return {
      icon: "settings",
      title: "Wireshark profile unavailable",
      description: "The configured profile could not be opened.",
      hint: "Choose an existing Wireshark profile, or clear the profile setting to use the default configuration, then try again.",
      details,
      setting: "profile",
    };
  }
  if (/EACCES|EPERM|permission denied|access.*denied/i.test(details)) {
    return {
      icon: "lock",
      title: "Access was denied",
      description: "Crumbs couldn’t access the capture or start Wireshark.",
      hint: "Check that VS Code can read the file and run the configured sharkd executable.",
      details,
      setting: "sharkd",
    };
  }
  if (/timeout|timed out/i.test(details)) {
    return {
      icon: "clock",
      title: "Wireshark took too long to start",
      description: "The packet reader did not respond in time.",
      hint: "Check the sharkd executable and Wireshark profile in settings, then try again. The log may contain more details.",
      details,
      setting: "sharkd",
    };
  }
  if (/column.*format|frame list column/i.test(details)) {
    return {
      icon: "columns",
      title: "Check your packet columns",
      description: "One or more column formats could not be used.",
      hint: "Correct the column configuration or restore the default columns, then try again.",
      details,
      setting: "frameList.columns",
    };
  }
  return {
    icon: "warning",
    title: "Couldn’t load this capture",
    description: "Wireshark couldn’t read the requested packet data.",
    hint: "Check that the file is an accessible, supported packet capture, then try again. See the details or log for more information.",
    details,
  };
}
