import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createDemoResearchFixture } from "@/features/research/fixtures";
import { runResearchWorkflow } from "@/features/research/run-research-workflow";
import {
  createDurableWorkflowWriter,
  createSupabaseWorkflowPersistenceQueries,
  type WorkflowPersistenceQueries,
} from "@/features/research/supabase-workflow-writer";
import {
  createInMemoryResearchWorkflowStore,
  type ResearchWorkflowSnapshot,
} from "@/features/research/workflow-store";
import { createFixtureResearchProviders } from "@/providers/fixtures/research-providers";

const event = {
  ownerId: "user_ailian",
  projectId: "project_demo",
  runId: "run_demo",
};

let completedSnapshot: ResearchWorkflowSnapshot;

const createEmptyWorkflowFixture = () => {
  const fixture = createDemoResearchFixture();
  return {
    ...fixture,
    sources: [],
    chunks: [],
    claims: [],
    evidenceLinks: [],
    claimRelations: [],
  };
};

const createQueries = () => {
  const calls: string[] = [];
  const track = (name: string) =>
    vi.fn(async () => {
      calls.push(name);
    });
  const queries: WorkflowPersistenceQueries = {
    beginRun: track("beginRun"),
    upsertSources: track("upsertSources"),
    upsertChunks: track("upsertChunks"),
    upsertClaims: track("upsertClaims"),
    upsertEvidenceLinks: track("upsertEvidenceLinks"),
    upsertClaimRelations: track("upsertClaimRelations"),
    upsertCheckpoints: track("upsertCheckpoints"),
    upsertRunLogs: track("upsertRunLogs"),
    upsertReport: track("upsertReport"),
    finalizeRun: track("finalizeRun"),
    failRun: track("failRun"),
  };

  return { calls, queries };
};

beforeAll(async () => {
  const store = createInMemoryResearchWorkflowStore(createEmptyWorkflowFixture());
  const result = await runResearchWorkflow({
    runId: event.runId,
    ownerId: event.ownerId,
    manualSources: [],
    providers: createFixtureResearchProviders(),
    store,
    now: () => "2026-07-17T08:00:00.000Z",
  });

  expect(result.run.status).toBe("ready");
  completedSnapshot = store.getSnapshot();
});

describe("durable workflow writer", () => {
  it("persists a validated snapshot in dependency order before finalizing", async () => {
    const { calls, queries } = createQueries();
    const writer = createDurableWorkflowWriter(queries);

    await writer.begin(event);
    await writer.persist({ event, snapshot: structuredClone(completedSnapshot) });

    expect(calls).toEqual([
      "beginRun",
      "upsertSources",
      "upsertChunks",
      "upsertClaims",
      "upsertEvidenceLinks",
      "upsertClaimRelations",
      "upsertCheckpoints",
      "upsertRunLogs",
      "upsertReport",
      "finalizeRun",
    ]);
    expect(queries.finalizeRun).toHaveBeenCalledWith({
      ...event,
      searchCount: expect.any(Number),
      tokenCount: expect.any(Number),
      estimatedCostUsd: expect.any(Number),
    });
  });

  it("rejects a cross-project snapshot before writing any result rows", async () => {
    const { calls, queries } = createQueries();
    const writer = createDurableWorkflowWriter(queries);
    const snapshot = structuredClone(completedSnapshot);
    snapshot.sources[0].projectId = "project_other";

    await writer.begin(event);
    await expect(writer.persist({ event, snapshot })).rejects.toThrow(
      "WORKFLOW_PROJECT_MISMATCH",
    );

    expect(calls).toEqual(["beginRun"]);
  });

  it("maps rows, embeddings, and stable conflict keys in the Supabase adapter", async () => {
    const upserts: Array<{
      table: string;
      rows: unknown;
      options: { onConflict?: string } | undefined;
    }> = [];
    const client = {
      rpc: vi.fn(async () => ({ error: null })),
      from: vi.fn((table: string) => ({
        upsert: vi.fn(async (rows: unknown, options?: { onConflict?: string }) => {
          upserts.push({ table, rows, options });
          return { error: null };
        }),
      })),
    } as unknown as SupabaseClient;
    const queries = createSupabaseWorkflowPersistenceQueries(client);
    const snapshot = structuredClone(completedSnapshot);

    await queries.upsertSources(snapshot.sources);
    await queries.upsertChunks({ chunks: snapshot.chunks, embeddings: snapshot.embeddings });
    await queries.upsertClaims(snapshot.claims);
    await queries.upsertEvidenceLinks(snapshot.evidenceLinks);
    await queries.upsertClaimRelations(snapshot.claimRelations);
    await queries.upsertCheckpoints({
      projectId: event.projectId,
      checkpoints: snapshot.checkpoints,
    });
    await queries.upsertRunLogs({ projectId: event.projectId, entries: snapshot.runLogs });
    await queries.upsertReport(snapshot.reports[0]);

    expect(upserts.map(({ table, options }) => [table, options?.onConflict])).toEqual([
      ["sources", "id"],
      ["source_chunks", "id"],
      ["claims", "id"],
      ["evidence_links", "id"],
      ["claim_relations", "id"],
      ["workflow_checkpoints", "run_id,step"],
      ["run_logs", "id"],
      ["reports", "id"],
    ]);

    const chunkRows = upserts.find(({ table }) => table === "source_chunks")?.rows as Array<{
      embedding: string;
    }>;
    expect(chunkRows[0].embedding).toMatch(/^\[0(?:,0){1535}\]$/);

    const reportRows = upserts.find(({ table }) => table === "reports")?.rows as Array<{
      status: string;
      slug: string | null;
      published_at: string | null;
    }>;
    expect(reportRows[0]).toMatchObject({
      status: "draft",
      slug: null,
      published_at: null,
    });
  });
});
