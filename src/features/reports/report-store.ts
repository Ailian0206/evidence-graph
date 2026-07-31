import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { findPublicCaseReport } from "@/features/reports/public-case-reports";
import { findPublicReportFixture } from "@/features/reports/report-fixture";
import { createReviewedReportSnapshot } from "@/features/reports/reviewed-report";
import {
  reportCitationSchema,
  reportSectionSchema,
  researchReportSchema,
  type ReportCitation,
  type ReportSection,
} from "@/features/research/workflow-types";
import { isSupabasePublicConfigured } from "@/lib/supabase/config";

export const reportStatusSchema = z.enum(["draft", "published", "revoked"]);

export const publishableReportSchema = researchReportSchema.extend({
  slug: z.string().min(1).optional(),
  status: reportStatusSchema,
  publishedAt: z.string().datetime().optional(),
});

const publishedReportSchema = publishableReportSchema.extend({
  slug: z.string().min(1),
  status: z.literal("published"),
  publishedAt: z.string().datetime(),
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

export type ReportClaimRow = {
  id: string;
  project_id: string;
  review_status: "pending" | "accepted" | "rejected";
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
  listClaims: (input: { projectId: string }) => Promise<ReportClaimRow[]>;
  publishReviewed: (input: {
    projectId: string;
    baseReportId: string;
    markdown: string;
    sections: ReportSection[];
    citations: ReportCitation[];
  }) => Promise<ReportRow[]>;
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
  "REPORT_REVIEW_INCOMPLETE",
  "REPORT_NO_ACCEPTED_CONTENT",
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
  listClaims: async ({ projectId }) => {
    const { data, error } = await client
      .from("claims")
      .select("id,project_id,review_status")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    throwQueryError(error);
    return (data ?? []) as ReportClaimRow[];
  },
  publishReviewed: async ({
    projectId,
    baseReportId,
    markdown,
    sections,
    citations,
  }) => {
    const { data, error } = await client.rpc("publish_reviewed_report", {
      requested_project_id: projectId,
      requested_base_report_id: baseReportId,
      requested_markdown: markdown,
      requested_sections: sections,
      requested_citations: citations,
    });
    throwQueryError(error);
    return (data ?? []) as ReportRow[];
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

const mapPublishedReportRow = (row: ReportRow) => {
  try {
    return publishedReportSchema.parse(mapReportRow(row));
  } catch {
    throw new Error("REPORT_QUERY_FAILED");
  }
};

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
    const report = (await queries.listVersions({ projectId: parsed.projectId }))
      .map(mapReportRow)
      .find(
        (candidate) =>
          candidate.id === parsed.reportId && candidate.projectId === parsed.projectId,
      );

    if (!report) {
      throw new Error("REPORT_NOT_FOUND");
    }

    const claims = (await queries.listClaims({ projectId: parsed.projectId })).map(
      (row) => {
        if (row.project_id !== parsed.projectId) {
          throw new Error("REPORT_QUERY_FAILED");
        }

        return {
          id: z.string().min(1).parse(row.id),
          reviewStatus: z.enum(["pending", "accepted", "rejected"]).parse(row.review_status),
        };
      },
    );
    const snapshot = createReviewedReportSnapshot({ report, claims });
    const row = requireFirstRow(
      await queries.publishReviewed({
        projectId: parsed.projectId,
        baseReportId: parsed.reportId,
        ...snapshot,
      }),
    );

    return mapPublishedReportRow(row);
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
  const curatedReport = findPublicCaseReport(slug);
  if (curatedReport) {
    return publicReportSchema.parse(curatedReport);
  }

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
