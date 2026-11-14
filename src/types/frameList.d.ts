import type * as sharkd from "./sharkd";
import type {
  FilterCompletions,
  FilterState,
  FilterValidation,
} from "./displayFilter";

export interface InitResponse {
  numRows: number;
  columnHeaders: string[];
  colorCoding: boolean;
  filterState: FilterState;
  history: string[];
}

export interface FramesRequest {
  startIndex: number;
  endIndex: number;
  revision?: number;
}

export interface FramesResponse {
  frames: sharkd.FramesResponse[];
  revision: number;
}

export interface FocusRequest {
  frameId: number;
  reveal: boolean;
  revision?: number;
}

export type FrameListMethods = {
  init: () => InitResponse;
  retry: () => void;
  openSettings: (params: {
    setting: "sharkd" | "profile" | "frameList.columns";
  }) => void;
  showLog: () => void;
  frames: (params: FramesRequest) => FramesResponse;
  focus: (params: FocusRequest) => void;
  validateFilter: (params: { filter: string }) => FilterValidation;
  completeFilter: (params: {
    text: string;
    cursor: number;
  }) => FilterCompletions;
  applyFilter: (params: { filter: string }) => FilterState;
  filterHistory: (params: { remove?: string }) => string[];
};

export type FrameListWebviewMethods = {
  filter: (state: FilterState) => void;
  prepareFilter: (params: { filter: string }) => void;
  history: (items: string[]) => void;
};
