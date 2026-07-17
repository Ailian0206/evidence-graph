import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createResearchInputSchema,
  managedProjectSchema,
  updateProjectInputSchema,
  type CreatedManagedResearch,
  type ManagedProject,
  type ProjectStore,
} from "@/features/projects/project-store";
import { researchRunSchema, type ResearchRun } from "@/features/research/domain";

export type ProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  question: string;
  language: "zh" | "en";
  status: "active" | "archived" | "deleted";
  visibility: "private" | "public";
  slug: string;
  created_at: string;
  updated_at: string;
};

export type ResearchRunRow = {
  id: string;
  project_id: string;
  owner_id: string;
  status: "queued" | "running" | "ready" | "failed" | "cancelled";
  step:
    | "queued"
    | "planning"
    | "searching"
    | "collecting"
    | "indexing"
    | "extracting_claims"
    | "linking_evidence"
    | "detecting_conflicts"
    | "drafting_report"
    | "ready"
    | "failed"
    | "cancelled";
  source_limit: number;
  manual_url_limit: number;
  manual_urls: string[];
  max_content_chars: number;
  estimated_cost_usd: number;
  search_count: number;
  token_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectUpdateRow = Partial<
  Pick<ProjectRow, "title" | "question" | "language" | "status" | "visibility" | "updated_at">
>;

export type ProjectQueryAdapter = {
  listProjects: (input: { ownerId: string }) => Promise<ProjectRow[]>;
  getProject: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<ProjectRow | null>;
  createResearch: (input: {
    ownerId: string;
    projectId: string;
    runId: string;
    slug: string;
    input: {
      title: string;
      question: string;
      language: "zh" | "en";
      manualUrls: string[];
    };
  }) => Promise<{ project: ProjectRow; run: ResearchRunRow }>;
  markResearchDispatchFailed: (input: {
    ownerId: string;
    projectId: string;
    runId: string;
  }) => Promise<void>;
  updateProject: (input: {
    ownerId: string;
    projectId: string;
    updates: ProjectUpdateRow;
  }) => Promise<ProjectRow | null>;
  deleteProject: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<ProjectRow | null>;
};

const projectColumns =
  "id,owner_id,title,question,language,status,visibility,slug,created_at,updated_at";
const researchRunColumns =
  "id,project_id,owner_id,status,step,source_limit,manual_url_limit,manual_urls,max_content_chars,estimated_cost_usd,search_count,token_count,error_message,created_at,updated_at";

const normalizeTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
};

const throwQueryError = (error: { message: string } | null) => {
  if (error) {
    throw error;
  }
};

export const createSupabaseProjectQueryAdapter = (
  client: SupabaseClient,
): ProjectQueryAdapter => ({
  listProjects: async ({ ownerId }) => {
    const { data, error } = await client
      .from("projects")
      .select(projectColumns)
      .eq("owner_id", ownerId)
      .neq("status", "deleted")
      .order("updated_at", { ascending: false });
    throwQueryError(error);
    return (data ?? []) as ProjectRow[];
  },
  getProject: async ({ ownerId, projectId }) => {
    const { data, error } = await client
      .from("projects")
      .select(projectColumns)
      .eq("owner_id", ownerId)
      .eq("id", projectId)
      .neq("status", "deleted")
      .maybeSingle();
    throwQueryError(error);
    return data as ProjectRow | null;
  },
  createResearch: async ({ ownerId, projectId, runId, slug, input }) => {
    const { error } = await client.rpc("create_managed_research", {
      requested_project_id: projectId,
      requested_run_id: runId,
      requested_title: input.title,
      requested_question: input.question,
      requested_language: input.language,
      requested_slug: slug,
      requested_manual_urls: input.manualUrls,
    });
    throwQueryError(error);

    const projectResult = await client
      .from("projects")
      .select(projectColumns)
      .eq("owner_id", ownerId)
      .eq("id", projectId)
      .neq("status", "deleted")
      .maybeSingle();
    throwQueryError(projectResult.error);

    const runResult = await client
      .from("research_runs")
      .select(researchRunColumns)
      .eq("owner_id", ownerId)
      .eq("project_id", projectId)
      .eq("id", runId)
      .maybeSingle();
    throwQueryError(runResult.error);

    if (!projectResult.data || !runResult.data) {
      throw new Error("RESEARCH_CREATION_RESULT_NOT_FOUND");
    }

    return {
      project: projectResult.data as ProjectRow,
      run: runResult.data as ResearchRunRow,
    };
  },
  markResearchDispatchFailed: async ({ projectId, runId }) => {
    const { error } = await client.rpc("fail_owned_research_dispatch", {
      requested_project_id: projectId,
      requested_run_id: runId,
    });
    throwQueryError(error);
  },
  updateProject: async ({ ownerId, projectId, updates }) => {
    const { data, error } = await client
      .from("projects")
      .update(updates)
      .eq("owner_id", ownerId)
      .eq("id", projectId)
      .neq("status", "deleted")
      .select(projectColumns)
      .maybeSingle();
    throwQueryError(error);
    return data as ProjectRow | null;
  },
  deleteProject: async ({ ownerId, projectId }) => {
    const { data, error } = await client
      .from("projects")
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", projectId)
      .select(projectColumns)
      .maybeSingle();
    throwQueryError(error);
    return data as ProjectRow | null;
  },
});

const mapProjectRow = (row: ProjectRow): ManagedProject =>
  managedProjectSchema.parse({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    question: row.question,
    language: row.language,
    status: row.status,
    visibility: row.visibility,
    slug: row.slug,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  });

const mapResearchRunRow = (row: ResearchRunRow): ResearchRun =>
  researchRunSchema.parse({
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    status: row.status,
    step: row.step,
    sourceLimit: row.source_limit,
    manualUrlLimit: row.manual_url_limit,
    maxContentChars: row.max_content_chars,
    estimatedCostUsd: row.estimated_cost_usd,
    searchCount: row.search_count,
    tokenCount: row.token_count,
    errorMessage: row.error_message ?? undefined,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  });

const requireProjectRow = (row: ProjectRow | null) => {
  if (!row) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return row;
};

export const createSupabaseProjectRepository = ({
  queries,
  createProjectId = () => `project_${globalThis.crypto.randomUUID()}`,
  createRunId = () => `run_${globalThis.crypto.randomUUID()}`,
  now = () => new Date(),
}: {
  queries: ProjectQueryAdapter;
  createProjectId?: () => string;
  createRunId?: () => string;
  now?: () => Date;
}): ProjectStore => ({
  listProjects: async ({ ownerId }) =>
    (await queries.listProjects({ ownerId })).map(mapProjectRow),
  getProject: async ({ ownerId, projectId }) =>
    mapProjectRow(requireProjectRow(await queries.getProject({ ownerId, projectId }))),
  createResearch: async ({ ownerId, input }): Promise<CreatedManagedResearch> => {
    const parsed = createResearchInputSchema.parse(input);
    const projectId = createProjectId();
    const runId = createRunId();
    const created = await queries.createResearch({
      ownerId,
      projectId,
      runId,
      slug: `research-${projectId}`,
      input: parsed,
    });

    return {
      project: mapProjectRow(created.project),
      run: mapResearchRunRow(created.run),
    };
  },
  markResearchDispatchFailed: (input) => queries.markResearchDispatchFailed(input),
  updateProject: async ({ ownerId, projectId, input }) => {
    const parsed = updateProjectInputSchema.parse(input);
    const row = await queries.updateProject({
      ownerId,
      projectId,
      updates: {
        ...parsed,
        updated_at: now().toISOString(),
      },
    });
    return mapProjectRow(requireProjectRow(row));
  },
  deleteProject: async ({ ownerId, projectId }) => {
    requireProjectRow(await queries.deleteProject({ ownerId, projectId }));
  },
});
