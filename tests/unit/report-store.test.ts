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
  publish: vi.fn(async () => [
    {
      report_id: "report_v2",
      project_slug: "research-project-1",
      report_version: 2,
      report_status: "published" as const,
      report_published_at: "2026-07-17T18:00:00+08:00",
    },
  ]),
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

  it("publishes and revokes reports through stable result DTOs", async () => {
    const queries = createQueries();
    const store = createReportStore(queries);

    await expect(
      store.publish({
        ownerId: "owner_1",
        projectId: "project_1",
        reportId: "report_v2",
      }),
    ).resolves.toEqual({
      id: "report_v2",
      slug: "research-project-1",
      version: 2,
      status: "published",
      publishedAt: "2026-07-17T10:00:00.000Z",
    });
    await expect(
      store.revoke({ ownerId: "owner_1", projectId: "project_1" }),
    ).resolves.toEqual({ slug: "research-project-1", reportId: "report_v2" });

    expect(queries.publish).toHaveBeenCalledWith({
      projectId: "project_1",
      reportId: "report_v2",
    });
    expect(queries.revoke).toHaveBeenCalledWith({ projectId: "project_1" });
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
      store: createReportStore(createQueries({ publish: vi.fn(async () => []) })),
      invoke: (store: ReturnType<typeof createReportStore>) =>
        store.publish({
          ownerId: "owner_1",
          projectId: "project_1",
          reportId: "report_v2",
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
  it("uses explicit report columns, version ordering, and publishing RPCs", async () => {
    const order = vi.fn(async () => ({ data: [reportV2Row, reportV1Row], error: null }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            report_id: "report_v2",
            project_slug: "research-project-1",
            report_version: 2,
            report_status: "published",
            report_published_at: "2026-07-17T10:00:00.000Z",
          },
        ],
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
    await queries.publish({ projectId: "project_1", reportId: "report_v2" });
    await queries.revoke({ projectId: "project_1" });
    await queries.getPublicReport({ slug: "research-project-1" });

    expect(select).toHaveBeenCalledWith(
      "id,run_id,project_id,slug,markdown,sections,citations,version,status,published_at,created_at",
    );
    expect(eq).toHaveBeenCalledWith("project_id", "project_1");
    expect(order).toHaveBeenCalledWith("version", { ascending: false });
    expect(rpc).toHaveBeenNthCalledWith(1, "publish_report_version", {
      requested_project_id: "project_1",
      requested_report_id: "report_v2",
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
      queries.publish({ projectId: "project_1", reportId: "report_v2" }),
    ).rejects.toThrow("REPORT_QUERY_FAILED");
  });
});
