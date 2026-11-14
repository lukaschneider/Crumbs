import { createRoot } from "react-dom/client";
import { FrameListView } from "./FrameListView";
import { createWebviewRpc } from "./rpc";

const rpc = createWebviewRpc();
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<FrameListView rpc={rpc} />);
}
