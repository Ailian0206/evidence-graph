import { WorkspaceState } from "@/components/evidence-workspace/workspace-state";

export default function WorkspaceNotFound() {
  return <WorkspaceState state="not-found" actionHref="/evidence" />;
}
