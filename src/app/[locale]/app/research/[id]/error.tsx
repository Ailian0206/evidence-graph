"use client";

import { WorkspaceState } from "@/components/evidence-workspace/workspace-state";

export default function WorkspaceError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <WorkspaceState state="failed" onAction={unstable_retry} />;
}
