import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { AppLocale } from "@/i18n/routing";

export type ReportListRow = {
  id: string;
  project_id: string;
  slug: string | null;
  version: number;
  status: "draft" | "published" | "revoked";
  published_at: string | null;
  created_at: string;
  projects: {
    title: string;
    question: string;
    language: AppLocale;
  };
};

export type ManagedReportSummary = {
  id: string;
  projectId: string;
  projectTitle: string;
  question: string;
  language: AppLocale;
  version: number;
  status: "draft" | "published" | "revoked";
  slug?: string;
  publishedAt?: string;
  createdAt: string;
};

export type ReportListQueryAdapter = {
  listOwnedReports: (input: { ownerId: string }) => Promise<ReportListRow[]>;
};

const reportListRowSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().min(1),
  slug: z.string().min(1).nullable(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "published", "revoked"]),
  published_at: z.string().nullable(),
  created_at: z.string().min(1),
  projects: z.object({
    title: z.string().min(1),
    question: z.string().min(1),
    language: z.enum(["zh", "en"]),
  }),
});

const reportListColumns =
  "id,project_id,slug,version,status,published_at,created_at,projects!inner(title,question,language,status,owner_id)";

const normalizeTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
};

export const createSupabaseReportListQueryAdapter = (
  client: SupabaseClient,
): ReportListQueryAdapter => ({
  listOwnedReports: async ({ ownerId }) => {
    const { data, error } = await client
      .from("reports")
      .select(reportListColumns)
      .eq("projects.owner_id", ownerId)
      .neq("projects.status", "deleted")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("REPORT_LIST_QUERY_FAILED");
    }

    return (data ?? []) as unknown as ReportListRow[];
  },
});

const mapReportListRow = (input: ReportListRow): ManagedReportSummary => {
  const row = reportListRowSchema.parse(input);

  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle: row.projects.title,
    question: row.projects.question,
    language: row.projects.language,
    version: row.version,
    status: row.status,
    slug: row.slug ?? undefined,
    publishedAt: row.published_at ? normalizeTimestamp(row.published_at) : undefined,
    createdAt: normalizeTimestamp(row.created_at),
  };
};

export const createManagedReportListStore = (queries: ReportListQueryAdapter) => ({
  list: async ({ ownerId }: { ownerId: string }) => {
    const parsedOwnerId = z.string().trim().min(1).parse(ownerId);
    const rows = await queries.listOwnedReports({ ownerId: parsedOwnerId });
    return rows.map(mapReportListRow);
  },
});
