import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createManagedReportListStore,
  createSupabaseReportListQueryAdapter,
  type ReportListQueryAdapter,
  type ReportListRow,
} from "@/features/reports/report-list-store";

const publishedRow: ReportListRow = {
  id: "report_2",
  project_id: "project_1",
  slug: "research-project-1",
  version: 2,
  status: "published",
  published_at: "2026-07-17T18:00:00+08:00",
  created_at: "2026-07-17T09:00:00.000Z",
  projects: {
    title: "Traceable research",
    question: "How should exact citations be reviewed?",
    language: "en",
  },
};

const draftRow: ReportListRow = {
  ...publishedRow,
  id: "report_1",
  slug: null,
  version: 1,
  status: "draft",
  published_at: null,
  created_at: "2026-07-17T08:00:00.000Z",
};

describe("managed report list store", () => {
  it("maps owner-scoped report summaries in query order", async () => {
    const queries: ReportListQueryAdapter = {
      listOwnedReports: vi.fn(async () => [publishedRow, draftRow]),
    };
    const store = createManagedReportListStore(queries);

    await expect(store.list({ ownerId: "owner_1" })).resolves.toEqual([
      {
        id: "report_2",
        projectId: "project_1",
        projectTitle: "Traceable research",
        question: "How should exact citations be reviewed?",
        language: "en",
        version: 2,
        status: "published",
        slug: "research-project-1",
        publishedAt: "2026-07-17T10:00:00.000Z",
        createdAt: "2026-07-17T09:00:00.000Z",
      },
      expect.objectContaining({
        id: "report_1",
        status: "draft",
        slug: undefined,
        publishedAt: undefined,
      }),
    ]);
    expect(queries.listOwnedReports).toHaveBeenCalledWith({ ownerId: "owner_1" });
  });

  it("rejects malformed joined project data", async () => {
    const store = createManagedReportListStore({
      listOwnedReports: vi.fn(async () => [
        { ...publishedRow, projects: { ...publishedRow.projects, title: "" } },
      ]),
    });

    await expect(store.list({ ownerId: "owner_1" })).rejects.toThrow();
  });
});

describe("Supabase managed report list adapter", () => {
  it("filters by the joined owner and excludes deleted projects", async () => {
    const order = vi.fn(async () => ({ data: [publishedRow, draftRow], error: null }));
    const neq = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ neq }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const adapter = createSupabaseReportListQueryAdapter({ from } as unknown as SupabaseClient);

    await expect(adapter.listOwnedReports({ ownerId: "owner_1" })).resolves.toEqual([
      publishedRow,
      draftRow,
    ]);

    expect(from).toHaveBeenCalledWith("reports");
    expect(select).toHaveBeenCalledWith(
      "id,project_id,slug,version,status,published_at,created_at,projects!inner(title,question,language,status,owner_id)",
    );
    expect(eq).toHaveBeenCalledWith("projects.owner_id", "owner_1");
    expect(neq).toHaveBeenCalledWith("projects.status", "deleted");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("maps raw database failures to a stable error", async () => {
    const order = vi.fn(async () => ({
      data: null,
      error: { message: "private database connection detail" },
    }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ neq: vi.fn(() => ({ order })) })),
        })),
      })),
    } as unknown as SupabaseClient;

    await expect(
      createSupabaseReportListQueryAdapter(client).listOwnedReports({ ownerId: "owner_1" }),
    ).rejects.toThrow("REPORT_LIST_QUERY_FAILED");
  });
});
