import type * as sharkd from "./sharkd";

export interface InitResponse {
  numRows: number;
  columnHeaders: string[];
  colorCoding: boolean;
}

export interface FramesRequest {
  startIndex: number;
  endIndex: number;
}

export interface FramesResponse {
  frames: sharkd.FramesResponse[];
}

export interface FocusRequest {
  frameId: number;
  reveal: boolean;
}

export type FrameListMethods = {
  init: () => InitResponse;
  frames: (params: FramesRequest) => FramesResponse;
  focus: (params: FocusRequest) => void;
};

export type FrameListWebviewMethods = {
  reset: () => boolean;
};
