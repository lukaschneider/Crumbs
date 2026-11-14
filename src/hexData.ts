import type { FrameRequest } from "./types/frameHex";
import type { ByteRange, FrameResponse, TreeNode } from "./types/sharkd";

export function getHexFrame(frame?: FrameResponse): FrameRequest | null {
  if (frame?.bytes === undefined) {
    return null;
  }
  const ranges = new Map<string, ByteRange>();
  const visit = (node: TreeNode) => {
    if (node.h && node.h[1] > 0 && !node.g && !node.ds) {
      ranges.set(node.h.join(":"), node.h);
    }
    node.n?.forEach(visit);
  };
  frame.tree?.forEach(visit);
  return { bytes: frame.bytes, byteRanges: [...ranges.values()] };
}
