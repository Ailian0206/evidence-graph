import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { findPublicReportFixture } from "@/features/reports/report-fixture";
import {
  reportCitationSchema,
  reportSectionSchema,
  researchReportSchema,
} from "@/features/research/workflow-types";
import { isSupabasePublicConfigured } from "@/lib/supabase/config";

export const reportStatusSchema = z.enum(["draft", "published", "revoked"]);

export const publishableReportSchema = researchReportSchema.extend({
  slug: z.string().min(1).optional(),
  status: reportStatusSchema,
  publishedAt: z.string().datetime().optional(),
});

const publicReportSnapshotSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  markdown: z.string().min(1),
  sections: z.array(reportSectionSchema).min(1),
  citations: z.array(reportCitationSchema),
  version: z.number().int().positive(),
  status: z.literal("published"),
  publishedAt: z.string().datetime(),
});

export const publicReportSchema = z.object({
  language: z.enum(["zh", "en"]),
  title: z.string().min(1),
  question: z.string().min(1),
  report: publicReportSnapshotSchema,
});

export type PublishableReport = z.infer<typeof publishableReportSchema>;
export type PublicReport = z.infer<typeof publicReportSchema>;

export type ReportRow = {
  id: string;
  run_id: string;
  project_id: string;
  slug: string | null;
  markdown: string;
  sections: unknown;
  citations: unknown;
  version: number;
  status: "draft" | "published" | "revoked";
  published_at: string | null;
  created_at: string;
};

type PublishReportRow = {
  report_id: string;
  project_slug: string;
  report_version: number;
  report_status: "published";
  report_published_at: string;
};

type RevokeReportRow = {
  project_slug: string;
  revoked_report_id: string | null;
};

export type PublicReportRow = {
  report_id: string;
  project_slug: string;
  title: string;
  question: string;
  language: "zh" | "en";
  markdown: string;
  sections: unknown;
  citations: unknown;
  version: number;
  published_at: string;
};

export type ReportQueryAdapter = {
  listVersions: (input: { projectId: string }) => Promise<ReportRow[]>;
  publish: (input: {
    projectId: string;
    reportId: string;
  }) => Promise<PublishReportRow[]>;
  revoke: (input: { projectId: string }) => Promise<RevokeReportRow[]>;
  getPublicReport: (input: { slug: string }) => Promise<PublicReportRow[]>;
};

export const reportColumns =
  "id,run_id,project_id,slug,markdown,sections,citations,version,status,published_at,created_at";

const normalizeTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
};

const stableReportErrorCodes = [
  "REPORT_NOT_FOUND",
  "REPORT_NOT_PUBLISHABLE",
  "PROJECT_NOT_PUBLISHABLE",
] as const;

const throwQueryError = (error: { message: string } | null) => {
  if (!error) {
    return;
  }

  const stableCode = stableReportErrorCodes.find((code) => error.message.includes(code));
  throw new Error(stableCode ?? "REPORT_QUERY_FAILED");
};

export const createSupabaseReportQueryAdapter = (
  client: SupabaseClient,
): ReportQueryAdapter => ({
  listVersions: async ({ projectId }) => {
    const { data, error } = await client
      .from("reports")
      .select(reportColumns)
      .eq("project_id", projectId)
      .order("version", { ascending: false });
    throwQueryError(error);
    return (data ?? []) as ReportRow[];
  },
  publish: async ({ projectId, reportId }) => {
    const { data, error } = await client.rpc("publish_report_version", {
      requested_project_id: projectId,
      requested_report_id: reportId,
    });
    throwQueryError(error);
    return (data ?? []) as PublishReportRow[];
  },
  revoke: async ({ projectId }) => {
    const { data, error } = await client.rpc("revoke_published_report", {
      requested_project_id: projectId,
    });
    throwQueryError(error);
    return (data ?? []) as RevokeReportRow[];
  },
  getPublicReport: async ({ slug }) => {
    const { data, error } = await client.rpc("get_public_report", {
      requested_slug: slug,
    });
    throwQueryError(error);
    return (data ?? []) as PublicReportRow[];
  },
});

export const mapReportRow = (row: ReportRow): PublishableReport =>
  publishableReportSchema.parse({
    id: row.id,
    runId: row.run_id,
    projectId: row.project_id,
    slug: row.slug ?? undefined,
    markdown: row.markdown,
    sections: row.sections,
    citations: row.citations,
    version: row.version,
    status: row.status,
    publishedAt: row.published_at ? normalizeTimestamp(row.published_at) : undefined,
    createdAt: normalizeTimestamp(row.created_at),
  });

const requireFirstRow = <T>(rows: T[]) => {
  const row = rows[0];
  if (!row) {
    throw new Error("REPORT_NOT_FOUND");
  }
  return row;
};

const ownedReportInputSchema = z.object({
  ownerId: z.string().min(1),
  projectId: z.string().min(1),
});

export const createReportStore = (queries: ReportQueryAdapter) => ({
  listVersions: async (input: { ownerId: string; projectId: string }) => {
    const { projectId } = ownedReportInputSchema.parse(input);
    return (await queries.listVersions({ projectId })).map(mapReportRow);
  },
  publish: async (input: { ownerId: string; projectId: string; reportId: string }) => {
    const parsed = ownedReportInputSchema
      .extend({ reportId: z.string().min(1) })
      .parse(input);
    const row = requireFirstRow(
      await queries.publish({
        projectId: parsed.projectId,
        reportId: parsed.reportId,
      }),
    );
    return {
      id: row.report_id,
      slug: row.project_slug,
      version: row.report_version,
      status: row.report_status,
      publishedAt: normalizeTimestamp(row.report_published_at),
    };
  },
  revoke: async (input: { ownerId: string; projectId: string }) => {
    const { projectId } = ownedReportInputSchema.parse(input);
    const row = requireFirstRow(await queries.revoke({ projectId }));
    return {
      slug: row.project_slug,
      reportId: row.revoked_report_id ?? undefined,
    };
  },
  getPublicReport: async ({ slug }: { slug: string }): Promise<PublicReport> => {
    const parsedSlug = z.string().min(1).parse(slug);
    const row = requireFirstRow(await queries.getPublicReport({ slug: parsedSlug }));
    return publicReportSchema.parse({
      language: row.language,
      title: row.title,
      question: row.question,
      report: {
        id: row.report_id,
        slug: row.project_slug,
        markdown: row.markdown,
        sections: row.sections,
        citations: row.citations,
        version: row.version,
        status: "published",
        publishedAt: normalizeTimestamp(row.published_at),
      },
    });
  },
});

type PublicReportDependencies = {
  isSupabaseConfigured: () => boolean;
  createQueries: () => Promise<ReportQueryAdapter> | ReportQueryAdapter;
};

const createProductionPublicReportDependencies = (): PublicReportDependencies => ({
  isSupabaseConfigured: isSupabasePublicConfigured,
  createQueries: async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    return createSupabaseReportQueryAdapter(await createSupabaseServerClient());
  },
});

export const getPublicReport = async (
  { slug }: { slug: string },
  dependencies: PublicReportDependencies = createProductionPublicReportDependencies(),
) => {
  const fixture = findPublicReportFixture(slug);
  if (fixture) {
    return publicReportSchema.parse(fixture);
  }

  if (!dependencies.isSupabaseConfigured()) {
    throw new Error("REPORT_NOT_FOUND");
  }

  const queries = await dependencies.createQueries();
  return createReportStore(queries).getPublicReport({ slug });
};
