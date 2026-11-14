import { createRoot } from "react-dom/client";
import { createWebviewRpc } from "./rpc";
import { TreeWelcomeView } from "./TreeWelcomeView";

const rpc = createWebviewRpc();
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<TreeWelcomeView rpc={rpc} />);
}
