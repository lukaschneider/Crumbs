import type { FramesResponse } from "../types/sharkd";

export interface GridRow {
  id: number;
  values: string[];
  background?: string;
  foreground?: string;
}
export function toGridRow(
  frame: FramesResponse,
  colorCoding: boolean,
): GridRow {
  const color = (value?: string) =>
    colorCoding && value && /^[0-9a-f]{6}$/i.test(value)
      ? `#${value}`
      : undefined;
  return {
    id: frame.num,
    values: frame.c,
    background: color(frame.bg),
    foreground: color(frame.fg),
  };
}
