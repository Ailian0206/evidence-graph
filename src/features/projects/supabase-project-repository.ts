import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createProjectInputSchema,
  managedProjectSchema,
  updateProjectInputSchema,
  type ManagedProject,
  type ProjectStore,
} from "@/features/projects/project-store";

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

type ProjectUpdateRow = Partial<
  Pick<ProjectRow, "title" | "question" | "language" | "status" | "visibility" | "updated_at">
>;

type MonthlyUsageRow = {
  run_count: number;
};

export type ProjectQueryAdapter = {
  listProjects: (input: { ownerId: string }) => Promise<ProjectRow[]>;
  getProject: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<ProjectRow | null>;
  insertProject: (input: {
    ownerId: string;
    row: ProjectRow;
  }) => Promise<ProjectRow | null>;
  updateProject: (input: {
    ownerId: string;
    projectId: string;
    updates: ProjectUpdateRow;
  }) => Promise<ProjectRow | null>;
  deleteProject: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<ProjectRow | null>;
  getMonthlyUsage: (input: {
    ownerId: string;
    month: string;
  }) => Promise<MonthlyUsageRow | null>;
};

const projectColumns =
  "id,owner_id,title,question,language,status,visibility,slug,created_at,updated_at";

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
  insertProject: async ({ ownerId, row }) => {
    if (row.owner_id !== ownerId) {
      throw new Error("PROJECT_OWNER_MISMATCH");
    }

    const { data, error } = await client
      .from("projects")
      .insert(row)
      .select(projectColumns)
      .maybeSingle();
    throwQueryError(error);
    return data as ProjectRow | null;
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
  getMonthlyUsage: async ({ ownerId, month }) => {
    const { data, error } = await client
      .from("usage_monthly")
      .select("run_count")
      .eq("owner_id", ownerId)
      .eq("month", month)
      .maybeSingle();
    throwQueryError(error);
    return data as MonthlyUsageRow | null;
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

const requireProjectRow = (row: ProjectRow | null) => {
  if (!row) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return row;
};

const getMonthStart = (date: Date) => `${date.toISOString().slice(0, 7)}-01`;

export const createSupabaseProjectRepository = ({
  queries,
  createId = () => `project_${globalThis.crypto.randomUUID()}`,
  now = () => new Date(),
}: {
  queries: ProjectQueryAdapter;
  createId?: () => string;
  now?: () => Date;
}): ProjectStore => ({
  listProjects: async ({ ownerId }) =>
    (await queries.listProjects({ ownerId })).map(mapProjectRow),
  getProject: async ({ ownerId, projectId }) =>
    mapProjectRow(requireProjectRow(await queries.getProject({ ownerId, projectId }))),
  createProject: async ({ ownerId, input }) => {
    const parsed = createProjectInputSchema.parse(input);
    const createdAt = now();
    const usage = await queries.getMonthlyUsage({
      ownerId,
      month: getMonthStart(createdAt),
    });

    if ((usage?.run_count ?? 0) >= 3) {
      throw new Error("MONTHLY_RUN_LIMIT_EXCEEDED");
    }

    const id = createId();
    const timestamp = createdAt.toISOString();
    const row = await queries.insertProject({
      ownerId,
      row: {
        id,
        owner_id: ownerId,
        title: parsed.title,
        question: parsed.question,
        language: parsed.language,
        status: "active",
        visibility: "private",
        slug: `research-${id}`,
        created_at: timestamp,
        updated_at: timestamp,
      },
    });

    return mapProjectRow(requireProjectRow(row));
  },
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
