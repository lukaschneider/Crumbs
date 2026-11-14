import type { ByteRange } from "./sharkd";

export interface FrameRequest {
  bytes: string;
  byteRanges: ByteRange[];
}
export interface FrameUpdate {
  revision: number;
  frame: FrameRequest | null;
}
export interface InitResponse extends FrameUpdate {
  rowLength: number;
  setLength: number;
  enableRowWrap: boolean;
}
export interface FocusRequest {
  byteRange: ByteRange;
}
export type FrameHexMethods = {
  init: () => InitResponse;
  focus: (params: FocusRequest) => void;
};
export type FrameHexWebviewMethods = {
  frame: (params: FrameUpdate) => void;
  focus: (params: FocusRequest) => void;
  config: (
    params: Pick<InitResponse, "rowLength" | "setLength" | "enableRowWrap">,
  ) => void;
};
