/** biome-ignore-all lint/style/useNamingConvention: Keys are the user-visible column titles. */
import type { InfoResponse } from "./types/sharkd";
export const defaultColumns: Record<string, string> = {
  Number: "%m",
  Time: "%t",
  Source: "%s",
  Destination: "%d",
  Protocol: "%p",
  Length: "%L",
  Info: "%i",
};

export function getColumnFields(
  columns: Record<string, string>,
  info: InfoResponse,
) {
  if (Object.keys(columns).length === 0) {
    throw new Error("Configure at least one frame list column.");
  }
  const fields: Record<`column${number}`, string | number> = {};
  Object.values(columns).forEach((value, index) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Frame list column formats must be nonempty strings.");
    }
    if (value.startsWith("%")) {
      const format = info.columns.findIndex(
        (column) => column.format === value,
      );
      if (format < 0) {
        throw new Error(`Unknown frame list column format: ${value}`);
      }
      fields[`column${index}`] = format;
    } else {
      fields[`column${index}`] = /:-?\d+$/.test(value) ? value : `${value}:0`;
    }
  });
  return fields;
}
