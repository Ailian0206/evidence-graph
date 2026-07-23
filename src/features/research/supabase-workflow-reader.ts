import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  projectSchema,
  researchRunSchema,
  type Project,
  type ResearchRun,
} from "@/features/research/domain";
import { manualSourceUrlSchema } from "@/features/sources/manual-source-url";
import type { ResearchRequestedEventData } from "@/inngest/events";

const projectRowSchema = z.object({
  id: z.string().min(1),
  owner_id: z.string().min(1),
  title: z.string().min(1),
  question: z.string().min(1),
  language: z.enum(["zh", "en"]),
  status: z.enum(["active", "archived", "deleted"]),
  visibility: z.enum(["private", "public"]),
  slug: z.string().min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

const runRowSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().min(1),
  owner_id: z.string().min(1),
  status: z.enum(["queued", "running", "ready", "failed", "cancelled"]),
  step: z.enum([
    "queued",
    "planning",
    "searching",
    "collecting",
    "indexing",
    "extracting_claims",
    "linking_evidence",
    "detecting_conflicts",
    "drafting_report",
    "ready",
    "failed",
    "cancelled",
  ]),
  source_limit: z.number().int(),
  manual_url_limit: z.number().int(),
  manual_urls: z.array(manualSourceUrlSchema).max(5),
  max_content_chars: z.number().int(),
  estimated_cost_usd: z.coerce.number(),
  search_count: z.number().int(),
  token_count: z.number().int(),
  error_message: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export type WorkflowProjectRow = z.infer<typeof projectRowSchema>;
export type WorkflowRunRow = z.infer<typeof runRowSchema>;

export type WorkflowInputQueries = {
  getProject: (
    event: ResearchRequestedEventData,
  ) => Promise<WorkflowProjectRow | null>;
  getRun: (event: ResearchRequestedEventData) => Promise<WorkflowRunRow | null>;
};

export type WorkflowInput = {
  project: Project;
  run: ResearchRun;
  manualUrls: string[];
};

const normalizeTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
};

export const createWorkflowInputReader = (queries: WorkflowInputQueries) =>
  async (event: ResearchRequestedEventData): Promise<WorkflowInput> => {
    const [projectInput, runInput] = await Promise.all([
      queries.getProject(event),
      queries.getRun(event),
    ]);

    if (!projectInput || !runInput) {
      throw new Error("WORKFLOW_INPUT_NOT_FOUND");
    }

    const projectRow = projectRowSchema.parse(projectInput);
    const runRow = runRowSchema.parse(runInput);
    const project = projectSchema.parse({
      id: projectRow.id,
      ownerId: projectRow.owner_id,
      title: projectRow.title,
      question: projectRow.question,
      language: projectRow.language,
      status: projectRow.status,
      visibility: projectRow.visibility,
      slug: projectRow.slug,
      createdAt: normalizeTimestamp(projectRow.created_at),
      updatedAt: normalizeTimestamp(projectRow.updated_at),
    });
    const run = researchRunSchema.parse({
      id: runRow.id,
      projectId: runRow.project_id,
      ownerId: runRow.owner_id,
      status: runRow.status,
      step: runRow.step,
      sourceLimit: runRow.source_limit,
      manualUrlLimit: runRow.manual_url_limit,
      maxContentChars: runRow.max_content_chars,
      estimatedCostUsd: runRow.estimated_cost_usd,
      searchCount: runRow.search_count,
      tokenCount: runRow.token_count,
      errorMessage: runRow.error_message ?? undefined,
      createdAt: normalizeTimestamp(runRow.created_at),
      updatedAt: normalizeTimestamp(runRow.updated_at),
    });

    if (
      project.id !== event.projectId ||
      project.ownerId !== event.ownerId ||
      run.id !== event.runId ||
      run.projectId !== event.projectId ||
      run.ownerId !== event.ownerId
    ) {
      throw new Error("WORKFLOW_INPUT_MISMATCH");
    }

    return { project, run, manualUrls: runRow.manual_urls };
  };

const projectColumns =
  "id,owner_id,title,question,language,status,visibility,slug,created_at,updated_at";
const runColumns =
  "id,project_id,owner_id,status,step,source_limit,manual_url_limit,manual_urls,max_content_chars,estimated_cost_usd,search_count,token_count,error_message,created_at,updated_at";

const throwQueryError = (error: { message: string } | null) => {
  if (error) {
    throw error;
  }
};

export const createSupabaseWorkflowInputQueries = (
  client: SupabaseClient,
): WorkflowInputQueries => ({
  getProject: async ({ ownerId, projectId }) => {
    const { data, error } = await client
      .from("projects")
      .select(projectColumns)
      .eq("owner_id", ownerId)
      .eq("id", projectId)
      .maybeSingle();
    throwQueryError(error);
    return data ? projectRowSchema.parse(data) : null;
  },
  getRun: async ({ ownerId, projectId, runId }) => {
    const { data, error } = await client
      .from("research_runs")
      .select(runColumns)
      .eq("owner_id", ownerId)
      .eq("project_id", projectId)
      .eq("id", runId)
      .maybeSingle();
    throwQueryError(error);
    return data ? runRowSchema.parse(data) : null;
  },
});
