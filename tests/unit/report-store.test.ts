import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createReportStore,
  createSupabaseReportQueryAdapter,
  getPublicReport,
  type PublicReportRow,
  type ReportQueryAdapter,
  type ReportRow,
} from "@/features/reports/report-store";
import { publicReportSlugs } from "@/features/reports/report-fixture";
import { publicCaseReports } from "@/features/reports/public-case-reports";

const sections = [
  {
    id: "section_1",
    heading: "Finding",
    factual: true,
    markdown: "Finding [link_1]",
    citationIds: ["link_1"],
  },
];

const citations = [
  {
    evidenceLinkId: "link_1",
    claimId: "claim_1",
    chunkId: "chunk_1",
    sourceId: "source_1",
    quote: "Exact quote",
    sourceUrl: "https://example.com/source",
    sourceTitle: "Source",
  },
];

const reportV2Row: ReportRow = {
  id: "report_v2",
  run_id: "run_2",
  project_id: "project_1",
  slug: "research-project-1",
  markdown: "## Finding\n\nFinding [link_1]",
  sections,
  citations,
  version: 2,
  status: "published",
  published_at: "2026-07-17T18:00:00+08:00",
  created_at: "2026-07-17T09:00:00.000Z",
};

const reportV1Row: ReportRow = {
  ...reportV2Row,
  id: "report_v1",
  run_id: "run_1",
  slug: null,
  version: 1,
  status: "revoked",
  published_at: "2026-07-17T08:00:00.000Z",
  created_at: "2026-07-17T08:00:00.000Z",
};

const reportDraftRow: ReportRow = {
  ...reportV2Row,
  id: "report_draft",
  run_id: "run_2",
  slug: null,
  status: "draft",
  published_at: null,
};

const publishedReviewedRow: ReportRow = {
  ...reportV2Row,
  id: "report_reviewed_v3",
  run_id: "run_2",
  version: 3,
  created_at: "2026-07-17T10:00:00.000Z",
};

const publicReportRow: PublicReportRow = {
  report_id: "report_v2",
  project_slug: "research-project-1",
  title: "Traceable research",
  question: "How should exact citations be reviewed?",
  language: "en",
  markdown: reportV2Row.markdown,
  sections,
  citations,
  version: 2,
  published_at: "2026-07-17T18:00:00+08:00",
};

const createQueries = (
  overrides: Partial<ReportQueryAdapter> = {},
): ReportQueryAdapter => ({
  listVersions: vi.fn(async () => [reportV2Row, reportV1Row]),
  listClaims: vi.fn(async () => [
    { id: "claim_1", project_id: "project_1", review_status: "accepted" as const },
  ]),
  publishReviewed: vi.fn(async () => [publishedReviewedRow]),
  revoke: vi.fn(async () => [
    { project_slug: "research-project-1", revoked_report_id: "report_v2" },
  ]),
  getPublicReport: vi.fn(async () => [publicReportRow]),
  ...overrides,
});

describe("report store", () => {
  it("maps report versions in query order and normalizes timestamps", async () => {
    const queries = createQueries();
    const store = createReportStore(queries);

    await expect(
      store.listVersions({ ownerId: "owner_1", projectId: "project_1" }),
    ).resolves.toEqual([
      {
        id: "report_v2",
        runId: "run_2",
        projectId: "project_1",
        slug: "research-project-1",
        markdown: reportV2Row.markdown,
        sections,
        citations,
        version: 2,
        status: "published",
        publishedAt: "2026-07-17T10:00:00.000Z",
        createdAt: "2026-07-17T09:00:00.000Z",
      },
      expect.objectContaining({
        id: "report_v1",
        slug: undefined,
        status: "revoked",
        version: 1,
      }),
    ]);
    expect(queries.listVersions).toHaveBeenCalledWith({ projectId: "project_1" });
  });

  it("derives, publishes, and returns a complete immutable report version", async () => {
    const calls: string[] = [];
    const queries = createQueries({
      listVersions: vi.fn(async () => {
        calls.push("reports");
        return [reportDraftRow, reportV1Row];
      }),
      listClaims: vi.fn(async () => {
        calls.push("claims");
        return [
          { id: "claim_1", project_id: "project_1", review_status: "accepted" as const },
        ];
      }),
      publishReviewed: vi.fn(async () => {
        calls.push("publish");
        return [publishedReviewedRow];
      }),
    });
    const store = createReportStore(queries);

    await expect(
      store.publish({
        ownerId: "owner_1",
        projectId: "project_1",
        reportId: "report_draft",
      }),
    ).resolves.toEqual({
      id: "report_reviewed_v3",
      runId: "run_2",
      projectId: "project_1",
      slug: "research-project-1",
      markdown: reportV2Row.markdown,
      sections,
      citations,
      version: 3,
      status: "published",
      publishedAt: "2026-07-17T10:00:00.000Z",
      createdAt: "2026-07-17T10:00:00.000Z",
    });
    expect(calls).toEqual(["reports", "claims", "publish"]);
    expect(queries.publishReviewed).toHaveBeenCalledWith({
      projectId: "project_1",
      baseReportId: "report_draft",
      markdown: reportDraftRow.markdown,
      sections,
      citations,
    });
    await expect(
      store.revoke({ ownerId: "owner_1", projectId: "project_1" }),
    ).resolves.toEqual({ slug: "research-project-1", reportId: "report_v2" });

    expect(queries.revoke).toHaveBeenCalledWith({ projectId: "project_1" });
  });

  it.each(["REPORT_REVIEW_INCOMPLETE", "REPORT_NO_ACCEPTED_CONTENT"] as const)(
    "stops before the publishing RPC on %s",
    async (code) => {
      const reviewStatus =
        code === "REPORT_REVIEW_INCOMPLETE" ? ("pending" as const) : ("rejected" as const);
      const queries = createQueries({
        listVersions: vi.fn(async () => [reportDraftRow]),
        listClaims: vi.fn(async () => [
          { id: "claim_1", project_id: "project_1", review_status: reviewStatus },
        ]),
      });

      await expect(
        createReportStore(queries).publish({
          ownerId: "owner_1",
          projectId: "project_1",
          reportId: "report_draft",
        }),
      ).rejects.toThrow(code);
      expect(queries.publishReviewed).not.toHaveBeenCalled();
    },
  );

  it("stops before reading claims when the selected base report is missing", async () => {
    const queries = createQueries({ listVersions: vi.fn(async () => []) });

    await expect(
      createReportStore(queries).publish({
        ownerId: "owner_1",
        projectId: "project_1",
        reportId: "missing_report",
      }),
    ).rejects.toThrow("REPORT_NOT_FOUND");
    expect(queries.listClaims).not.toHaveBeenCalled();
    expect(queries.publishReviewed).not.toHaveBeenCalled();
  });

  it.each([
    { name: "missing slug", row: { ...publishedReviewedRow, slug: null } },
    {
      name: "non-published status",
      row: { ...publishedReviewedRow, slug: null, status: "revoked" as const },
    },
    {
      name: "missing publication timestamp",
      row: { ...publishedReviewedRow, published_at: null },
    },
  ])("rejects a reviewed RPC row with $name", async ({ row }) => {
    const queries = createQueries({
      listVersions: vi.fn(async () => [reportDraftRow]),
      publishReviewed: vi.fn(async () => [row]),
    });

    await expect(
      createReportStore(queries).publish({
        ownerId: "owner_1",
        projectId: "project_1",
        reportId: "report_draft",
      }),
    ).rejects.toThrow("REPORT_QUERY_FAILED");
  });

  it("maps only the immutable fields needed by the public report page", async () => {
    const store = createReportStore(createQueries());

    await expect(
      store.getPublicReport({ slug: "research-project-1" }),
    ).resolves.toEqual({
      language: "en",
      title: "Traceable research",
      question: "How should exact citations be reviewed?",
      report: {
        id: "report_v2",
        slug: "research-project-1",
        markdown: reportV2Row.markdown,
        sections,
        citations,
        version: 2,
        status: "published",
        publishedAt: "2026-07-17T10:00:00.000Z",
      },
    });
  });

  it.each([
    {
      name: "sections",
      row: { ...reportV2Row, sections: [{ heading: "Missing fields" }] },
    },
    {
      name: "citations",
      row: { ...reportV2Row, citations: [{ evidenceLinkId: "link_1" }] },
    },
  ])("rejects malformed report $name", async ({ row }) => {
    const store = createReportStore(
      createQueries({ listVersions: vi.fn(async () => [row as ReportRow]) }),
    );

    await expect(
      store.listVersions({ ownerId: "owner_1", projectId: "project_1" }),
    ).rejects.toThrow();
  });

  it.each([
    {
      operation: "publish",
      store: createReportStore(
        createQueries({
          listVersions: vi.fn(async () => [reportDraftRow]),
          publishReviewed: vi.fn(async () => []),
        }),
      ),
      invoke: (store: ReturnType<typeof createReportStore>) =>
        store.publish({
          ownerId: "owner_1",
          projectId: "project_1",
          reportId: "report_draft",
        }),
    },
    {
      operation: "public read",
      store: createReportStore(createQueries({ getPublicReport: vi.fn(async () => []) })),
      invoke: (store: ReturnType<typeof createReportStore>) =>
        store.getPublicReport({ slug: "missing" }),
    },
  ])("maps an empty $operation result to REPORT_NOT_FOUND", async ({ store, invoke }) => {
    await expect(invoke(store)).rejects.toThrow("REPORT_NOT_FOUND");
  });

  it("serves deterministic fixtures without creating a Supabase query adapter", async () => {
    const createQueries = vi.fn();

    await expect(
      getPublicReport(
        { slug: publicReportSlugs.zh },
        {
          isSupabaseConfigured: () => false,
          createQueries,
        },
      ),
    ).resolves.toMatchObject({
      language: "zh",
      report: { slug: publicReportSlugs.zh, status: "published" },
    });
    expect(createQueries).not.toHaveBeenCalled();
  });

  it("serves all curated C5 reports without Supabase", async () => {
    const createQueries = vi.fn();

    for (const curatedReport of publicCaseReports) {
      const result = await getPublicReport(
        { slug: curatedReport.report.slug },
        {
          isSupabaseConfigured: () => false,
          createQueries,
        },
      );

      expect(result).toEqual(curatedReport);
      expect(result.report.status).toBe("published");
    }

    expect(publicCaseReports).toHaveLength(3);
    expect(createQueries).not.toHaveBeenCalled();
  });

  it("keeps every curated factual section backed by complete HTTPS citations", () => {
    for (const curatedReport of publicCaseReports) {
      const citationsById = new Map(
        curatedReport.report.citations.map((citation) => [
          citation.evidenceLinkId,
          citation,
        ]),
      );

      for (const section of curatedReport.report.sections) {
        if (!section.factual) {
          continue;
        }

        expect(section.citationIds.length).toBeGreaterThan(0);
        for (const citationId of section.citationIds) {
          const citation = citationsById.get(citationId);
          expect(citation).toBeDefined();
          expect(citation?.sourceTitle.trim()).not.toBe("");
          expect(citation?.quote.trim()).not.toBe("");
          expect(citation?.sourceUrl).toMatch(/^https:\/\//);
          expect(section.markdown).toContain(`[${citationId}]`);
        }
      }
    }
  });

  it("returns REPORT_NOT_FOUND for unknown slugs when Supabase is not configured", async () => {
    await expect(
      getPublicReport(
        { slug: "unknown-report" },
        {
          isSupabaseConfigured: () => false,
          createQueries: vi.fn(),
        },
      ),
    ).rejects.toThrow("REPORT_NOT_FOUND");
  });
});

describe("Supabase report query adapter", () => {
  it("uses explicit columns, scoped ordering, and reviewed publishing RPCs", async () => {
    const reportOrder = vi.fn(async () => ({ data: [reportV2Row, reportV1Row], error: null }));
    const claimOrder = vi.fn(async () => ({
      data: [{ id: "claim_1", project_id: "project_1", review_status: "accepted" }],
      error: null,
    }));
    const reportEq = vi.fn(() => ({ order: reportOrder }));
    const claimEq = vi.fn(() => ({ order: claimOrder }));
    const reportSelect = vi.fn(() => ({ eq: reportEq }));
    const claimSelect = vi.fn(() => ({ eq: claimEq }));
    const from = vi.fn((table: string) => ({
      select: table === "reports" ? reportSelect : claimSelect,
    }));
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [publishedReviewedRow],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ project_slug: "research-project-1", revoked_report_id: "report_v2" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [publicReportRow], error: null });
    const client = { from, rpc } as unknown as SupabaseClient;
    const queries = createSupabaseReportQueryAdapter(client);

    await expect(queries.listVersions({ projectId: "project_1" })).resolves.toEqual([
      reportV2Row,
      reportV1Row,
    ]);
    await queries.listClaims({ projectId: "project_1" });
    await queries.publishReviewed({
      projectId: "project_1",
      baseReportId: "report_draft",
      markdown: reportDraftRow.markdown,
      sections,
      citations,
    });
    await queries.revoke({ projectId: "project_1" });
    await queries.getPublicReport({ slug: "research-project-1" });

    expect(reportSelect).toHaveBeenCalledWith(
      "id,run_id,project_id,slug,markdown,sections,citations,version,status,published_at,created_at",
    );
    expect(reportEq).toHaveBeenCalledWith("project_id", "project_1");
    expect(reportOrder).toHaveBeenCalledWith("version", { ascending: false });
    expect(claimSelect).toHaveBeenCalledWith("id,project_id,review_status");
    expect(claimEq).toHaveBeenCalledWith("project_id", "project_1");
    expect(claimOrder).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(rpc).toHaveBeenNthCalledWith(1, "publish_reviewed_report", {
      requested_project_id: "project_1",
      requested_base_report_id: "report_draft",
      requested_markdown: reportDraftRow.markdown,
      requested_sections: sections,
      requested_citations: citations,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "revoke_published_report", {
      requested_project_id: "project_1",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "get_public_report", {
      requested_slug: "research-project-1",
    });
  });

  it("does not expose raw Supabase errors", async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "private database detail" } })),
    } as unknown as SupabaseClient;
    const queries = createSupabaseReportQueryAdapter(client);

    await expect(
      queries.publishReviewed({
        projectId: "project_1",
        baseReportId: "report_v2",
        markdown: reportV2Row.markdown,
        sections,
        citations,
      }),
    ).rejects.toThrow("REPORT_QUERY_FAILED");
  });

  it.each(["REPORT_REVIEW_INCOMPLETE", "REPORT_NO_ACCEPTED_CONTENT"])(
    "preserves the stable %s database error",
    async (code) => {
      const client = {
        rpc: vi.fn(async () => ({ data: null, error: { message: code } })),
      } as unknown as SupabaseClient;

      await expect(
        createSupabaseReportQueryAdapter(client).publishReviewed({
          projectId: "project_1",
          baseReportId: "report_v2",
          markdown: reportV2Row.markdown,
          sections,
          citations,
        }),
      ).rejects.toThrow(code);
    },
  );
});
