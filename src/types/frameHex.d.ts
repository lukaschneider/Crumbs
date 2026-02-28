import type * as sharkd from "./sharkd";

export interface InitResponse {
  rowLength: number;
  setLength: number;
  enableRowWrap: boolean;
  frame?: FrameRequest;
}

export interface FrameRequest {
  buffer: Uint8Array;
  byteRanges: sharkd.ByteRange[];
}

export interface FocusRequest {
  byteRange: sharkd.ByteRange;
}

export type FrameHexMethods = {
  init: () => InitResponse;
  focus: (params: FocusRequest) => void;
};

export type FrameHexWebviewMethods = {
  frame: (params: FrameRequest) => void;
  focus: (params: FocusRequest) => void;
};
