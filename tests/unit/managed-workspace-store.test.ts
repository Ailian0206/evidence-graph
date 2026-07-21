import { describe, expect, it, vi } from "vitest";

import {
  createManagedWorkspaceStore,
  type ManagedWorkspaceQueryAdapter,
  type ManagedWorkspaceRows,
} from "@/features/research/managed-workspace-store";

const rows: ManagedWorkspaceRows = {
  project: {
    id: "project_1",
    owner_id: "owner_1",
    title: "持久化研究",
    question: "工作流结果如何安全保存？",
    status: "active",
    visibility: "private",
    slug: "research-project-1",
    created_at: "2026-07-17T08:00:00+00:00",
    updated_at: "2026-07-17T16:30:00+08:00",
  },
  run: {
    id: "run_1",
    project_id: "project_1",
    owner_id: "owner_1",
    status: "ready",
    step: "ready",
    source_limit: 12,
    manual_url_limit: 5,
    max_content_chars: 200000,
    estimated_cost_usd: 0.061,
    search_count: 3,
    token_count: 960,
    error_message: null,
    created_at: "2026-07-17T08:00:00.000Z",
    updated_at: "2026-07-17T08:08:00.000Z",
  },
  sources: [
    {
      id: "source_1",
      project_id: "project_1",
      canonical_url: "https://example.com/source",
      title: "研究来源",
      author: null,
      published_at: null,
      domain: "example.com",
      source_type: "official_document",
      body: "持久化结果必须保留精确证据。",
      content_hash: "sha256_source_1",
      retrieved_at: "2026-07-17T08:01:00.000Z",
    },
  ],
  chunks: [
    {
      id: "chunk_1",
      source_id: "source_1",
      project_id: "project_1",
      chunk_index: 0,
      body: "持久化结果必须保留精确证据。",
      start_char: 0,
      end_char: 16,
      embedding_model: "text-embedding-3-small",
      embedding_dimensions: 1536,
    },
  ],
  claims: [
    {
      id: "claim_1",
      project_id: "project_1",
      statement: "持久化结果保留精确证据。",
      normalized_key: "持久化结果保留精确证据",
      claim_type: "factual",
      qualifiers: [],
      confidence: 0.91,
      review_status: "pending",
      created_at: "2026-07-17T08:05:00.000Z",
    },
  ],
  evidenceLinks: [
    {
      id: "link_1",
      claim_id: "claim_1",
      chunk_id: "chunk_1",
      project_id: "project_1",
      relation: "supports",
      strength: "strong",
      quote: "保留精确证据",
      rationale: "来源直接支持该主张。",
    },
  ],
  claimRelations: [],
  runLogs: [
    {
      id: "log_1",
      run_id: "run_1",
      project_id: "project_1",
      step: "planning",
      status: "completed",
      attempt: 1,
      occurred_at: "2026-07-17T08:02:00.000Z",
      error_code: null,
    },
  ],
};

const createQueries = (
  overrides: Partial<ManagedWorkspaceQueryAdapter> = {},
): ManagedWorkspaceQueryAdapter => ({
  getProject: vi.fn(async () => rows.project),
  getLatestRun: vi.fn(async () => rows.run),
  listSources: vi.fn(async () => rows.sources),
  listChunks: vi.fn(async () => rows.chunks),
  listClaims: vi.fn(async () => rows.claims),
  listEvidenceLinks: vi.fn(async () => rows.evidenceLinks),
  listClaimRelations: vi.fn(async () => rows.claimRelations),
  listRunLogs: vi.fn(async () => rows.runLogs),
  ...overrides,
});

describe("managed workspace store", () => {
  it("returns not-found without reading child rows when the project is unavailable", async () => {
    const queries = createQueries({ getProject: vi.fn(async () => null) });
    const store = createManagedWorkspaceStore(queries);

    await expect(
      store.load({ ownerId: "owner_1", projectId: "missing", locale: "zh" }),
    ).resolves.toEqual({ state: "not-found" });
    expect(queries.getLatestRun).not.toHaveBeenCalled();
    expect(queries.listSources).not.toHaveBeenCalled();
  });

  it.each(["queued", "running"] as const)(
    "returns the minimal %s state without exposing partial rows",
    async (status) => {
      const queries = createQueries({
        getLatestRun: vi.fn(async () => ({
          ...rows.run,
          status,
          step: status === "queued" ? ("queued" as const) : ("planning" as const),
        })),
      });
      const store = createManagedWorkspaceStore(queries);

      await expect(
        store.load({ ownerId: "owner_1", projectId: "project_1", locale: "zh" }),
      ).resolves.toEqual({ state: status, runId: "run_1" });
      expect(queries.listSources).not.toHaveBeenCalled();
    },
  );

  it("returns a retryable dispatch failure without exposing partial rows", async () => {
    const queries = createQueries({
      getLatestRun: vi.fn(async () => ({
        ...rows.run,
        status: "failed" as const,
        step: "failed" as const,
        error_message: "RESEARCH_DISPATCH_FAILED",
      })),
    });
    const store = createManagedWorkspaceStore(queries);

    await expect(
      store.load({ ownerId: "owner_1", projectId: "project_1", locale: "en" }),
    ).resolves.toEqual({
      state: "failed",
      runId: "run_1",
      errorCode: "RESEARCH_DISPATCH_FAILED",
      canRetryDispatch: true,
    });
    expect(queries.listClaims).not.toHaveBeenCalled();
  });

  it("maps a ready snapshot and scopes every query to its owner or project", async () => {
    const queries = createQueries();
    const store = createManagedWorkspaceStore(queries);

    await expect(
      store.load({ ownerId: "owner_1", projectId: "project_1", locale: "zh" }),
    ).resolves.toEqual({
      state: "ready",
      data: {
        locale: "zh",
        project: expect.objectContaining({
          id: "project_1",
          ownerId: "owner_1",
          createdAt: "2026-07-17T08:00:00.000Z",
          updatedAt: "2026-07-17T08:30:00.000Z",
        }),
        run: expect.objectContaining({ id: "run_1", status: "ready" }),
        sources: [expect.objectContaining({ id: "source_1", author: undefined })],
        chunks: [expect.objectContaining({ id: "chunk_1", text: rows.chunks[0].body })],
        claims: [expect.objectContaining({ id: "claim_1", reviewStatus: "pending" })],
        evidenceLinks: [expect.objectContaining({ id: "link_1", relation: "supports" })],
        claimRelations: [],
        runLogs: [expect.objectContaining({ id: "log_1", errorCode: undefined })],
      },
    });

    expect(queries.getProject).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
    });
    expect(queries.getLatestRun).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
    });
    for (const method of [
      "listSources",
      "listChunks",
      "listClaims",
      "listEvidenceLinks",
      "listClaimRelations",
    ] as const) {
      expect(queries[method]).toHaveBeenCalledWith({ projectId: "project_1" });
    }
    expect(queries.listRunLogs).toHaveBeenCalledWith({
      projectId: "project_1",
      runId: "run_1",
    });
  });
});
