import { createRoot } from "react-dom/client";
import { HexView } from "./HexView";
import { createWebviewRpc } from "./rpc";

const rpc = createWebviewRpc();
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<HexView rpc={rpc} />);
}
