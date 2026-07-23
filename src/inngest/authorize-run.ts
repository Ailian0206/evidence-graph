import type { SupabaseClient } from "@supabase/supabase-js";
import { NonRetriableError } from "inngest";

import { runStatusSchema, type ResearchRun } from "@/features/research/domain";
import type { ResearchRequestedEventData } from "@/inngest/events";

export type ResearchRunAuthorization = {
  id: string;
  ownerId: string;
  projectId: string;
  status?: ResearchRun["status"];
};

export type ReadResearchRun = (
  input: ResearchRequestedEventData,
) => Promise<ResearchRunAuthorization | null>;

export const authorizeResearchRun = async ({
  event,
  readRun,
}: {
  event: ResearchRequestedEventData;
  readRun: ReadResearchRun;
}) => {
  const run = await readRun(event);

  if (
    !run ||
    run.id !== event.runId ||
    run.ownerId !== event.ownerId ||
    run.projectId !== event.projectId
  ) {
    throw new NonRetriableError("RUN_PROJECT_MISMATCH");
  }

  return run;
};

export const createSupabaseRunAuthorizationReader = (
  client: SupabaseClient,
): ReadResearchRun => async ({ ownerId, projectId, runId }) => {
  const { data, error } = await client
    .from("research_runs")
    .select("id,owner_id,project_id,status")
    .eq("id", runId)
    .eq("owner_id", ownerId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? {
        id: data.id as string,
        ownerId: data.owner_id as string,
        projectId: data.project_id as string,
        status: runStatusSchema.parse(data.status),
      }
    : null;
};
