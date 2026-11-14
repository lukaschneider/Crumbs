import type { TypedJSONRPCServerAndClient } from "json-rpc-2.0";
import { useEffect, useState } from "react";
import type {
  TreeWelcomeMethods,
  TreeWelcomeState,
  TreeWelcomeWebviewMethods,
} from "../types/treeWelcome";
import { EmptyState } from "./EmptyState";

type Rpc = TypedJSONRPCServerAndClient<
  TreeWelcomeWebviewMethods,
  TreeWelcomeMethods
>;

export function TreeWelcomeView({ rpc }: { rpc: Rpc }) {
  const [hasFrame, setHasFrame] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let revision = -1;
    const update = (state: TreeWelcomeState) => {
      if (!active || state.revision <= revision) {
        return;
      }
      revision = state.revision;
      setHasFrame(state.hasFrame);
      setError("");
    };
    rpc.addMethod("selection", update);
    void Promise.resolve(rpc.request("init"))
      .then(update)
      .catch((reason) => {
        if (active) {
          setError(String(reason));
        }
      });
    return () => {
      active = false;
      rpc.removeMethod("selection");
    };
  }, [rpc]);

  if (error) {
    return (
      <EmptyState
        icon="tree"
        compact
        alert
        title="Protocol tree unavailable"
        description="Select a packet again to retry."
        details={error}
      />
    );
  }
  return (
    <EmptyState
      icon="tree"
      compact
      title={hasFrame ? "No protocol fields to show" : "No packet selected"}
      description={
        hasFrame
          ? "Wireshark returned no protocol details for this packet."
          : "Select a packet in the capture to explore its protocol fields."
      }
    />
  );
}
