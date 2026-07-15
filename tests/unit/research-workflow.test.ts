import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createDemoResearchFixture } from "@/features/research/fixtures";
import { runResearchWorkflow } from "@/features/research/run-research-workflow";
import { createInMemoryResearchWorkflowStore } from "@/features/research/workflow-store";
import {
  claimCandidatesSchema,
  conflictCandidatesSchema,
  evidenceCandidatesSchema,
  reportDraftSchema,
} from "@/features/research/workflow-types";
import { searchResultSchema } from "@/providers/contracts";
import { createFixtureResearchProviders } from "@/providers/fixtures/research-providers";

describe("research provider fixtures", () => {
  it("returns deterministic structured data and records idempotency keys", async () => {
    const first = createFixtureResearchProviders();
    const second = createFixtureResearchProviders();

    const firstSearch = await first.search.search({
      query: "traceable AI research",
      maxResults: 12,
      idempotencyKey: "run_demo:searching:0",
    });
    const secondSearch = await second.search.search({
      query: "traceable AI research",
      maxResults: 12,
      idempotencyKey: "run_demo:searching:0",
    });

    expect(firstSearch).toEqual(secondSearch);
    expect(searchResultSchema.array().parse(firstSearch.data)).toHaveLength(2);
    expect(first.calls).toEqual([
      expect.objectContaining({
        operation: "search",
        idempotencyKey: "run_demo:searching:0",
      }),
    ]);
  });

  it("validates structured model output and returns stable embeddings", async () => {
    const providers = createFixtureResearchProviders();
    const planSchema = z.object({
      queries: z.array(z.string().min(1)).min(3).max(5),
    });

    const plan = await providers.languageModel.generateStructured({
      operation: "plan",
      schema: planSchema,
      payload: { question: "How does traceable research work?" },
      idempotencyKey: "run_demo:planning",
    });
    const embeddings = await providers.embedding.embed({
      texts: ["Exact quotes remain inspectable."],
      idempotencyKey: "run_demo:indexing",
    });

    expect(plan.data.queries).toHaveLength(3);
    expect(embeddings.data).toHaveLength(1);
    expect(embeddings.data[0]).toHaveLength(1536);
    expect(providers.calls.map((call) => call.operation)).toEqual(["plan", "embed"]);
  });

  it("returns schema-valid claim, evidence, conflict, and report outputs", async () => {
    const providers = createFixtureResearchProviders();
    const model = providers.languageModel;

    const claims = await model.generateStructured({
      operation: "extract_claims",
      schema: claimCandidatesSchema,
      payload: {},
      idempotencyKey: "run_demo:extracting_claims",
    });
    const evidence = await model.generateStructured({
      operation: "link_evidence",
      schema: evidenceCandidatesSchema,
      payload: {},
      idempotencyKey: "run_demo:linking_evidence",
    });
    const conflicts = await model.generateStructured({
      operation: "detect_conflicts",
      schema: conflictCandidatesSchema,
      payload: {},
      idempotencyKey: "run_demo:detecting_conflicts",
    });
    const report = await model.generateStructured({
      operation: "draft_report",
      schema: reportDraftSchema,
      payload: {},
      idempotencyKey: "run_demo:drafting_report",
    });

    expect(claims.data.claims).toHaveLength(2);
    expect(evidence.data.evidence.map((item) => item.relation)).toEqual(
      expect.arrayContaining(["supports", "rebuts"]),
    );
    expect(conflicts.data.relations).toHaveLength(1);
    expect(report.data.sections.every((section) => section.claimIds.length > 0)).toBe(true);
  });
});

describe("research workflow store", () => {
  it("enforces research run ownership", () => {
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());

    expect(store.requireRun({ runId: "run_demo", ownerId: "user_ailian" }).status).toBe(
      "queued",
    );
    expect(() =>
      store.requireRun({ runId: "run_demo", ownerId: "user_other" }),
    ).toThrow("RUN_NOT_FOUND");
  });

  it("upserts generated entities and returns detached snapshots", () => {
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const source = {
      id: "source_generated",
      projectId: "project_demo",
      canonicalUrl: "https://example.com/generated",
      title: "Generated research source",
      domain: "example.com",
      sourceType: "article" as const,
      body: "Generated evidence remains linked to an exact quote.",
      contentHash: "sha256_generated",
      retrievedAt: "2026-07-15T00:01:00.000Z",
    };
    const chunk = {
      id: "source_generated_chunk_0",
      sourceId: source.id,
      projectId: source.projectId,
      chunkIndex: 0,
      text: source.body,
      startChar: 0,
      endChar: source.body.length,
      embeddingModel: "text-embedding-3-small" as const,
      embeddingDimensions: 1536 as const,
    };
    const claim = {
      id: "claim_generated",
      projectId: source.projectId,
      statement: "Generated evidence remains linked to an exact quote.",
      normalizedKey: "generated evidence remains linked to an exact quote",
      claimType: "factual" as const,
      qualifiers: [],
      confidence: 0.8,
      reviewStatus: "pending" as const,
      createdAt: "2026-07-15T00:02:00.000Z",
    };
    const evidenceLink = {
      id: "link_generated",
      projectId: source.projectId,
      claimId: claim.id,
      chunkId: chunk.id,
      relation: "supports" as const,
      strength: "strong" as const,
      quote: "Generated evidence remains linked to an exact quote",
      rationale: "The generated source contains the exact statement.",
    };
    const claimRelation = {
      id: "relation_generated",
      projectId: source.projectId,
      fromClaimId: "claim_exact_quotes",
      toClaimId: claim.id,
      relation: "depends_on" as const,
      rationale: "The generated claim depends on exact-quote traceability.",
    };

    expect(store.upsertSource(source)).toEqual(source);
    expect(store.upsertSource({ ...source, id: "source_duplicate" })).toEqual(source);
    expect(store.upsertChunk(chunk)).toEqual(chunk);
    expect(store.upsertClaim(claim)).toEqual(claim);
    expect(store.upsertEvidenceLink(evidenceLink)).toEqual(evidenceLink);
    expect(store.upsertClaimRelation(claimRelation)).toEqual(claimRelation);

    const snapshot = store.getSnapshot();
    expect(snapshot.sources).toHaveLength(3);
    expect(snapshot.chunks).toHaveLength(3);
    expect(snapshot.claims).toHaveLength(2);
    expect(snapshot.evidenceLinks).toHaveLength(2);
    expect(snapshot.claimRelations).toEqual([claimRelation]);

    snapshot.sources[0].title = "Mutated outside the store";
    snapshot.claims[0].qualifiers.push("mutated");

    expect(store.getSnapshot().sources[0].title).not.toBe("Mutated outside the store");
    expect(store.getSnapshot().claims[0].qualifiers).not.toContain("mutated");
  });

  it("keeps one idempotent checkpoint per run step", () => {
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const checkpoint = {
      runId: "run_demo",
      step: "planning" as const,
      idempotencyKey: "run_demo:planning",
      output: { queries: ["traceable AI research"] },
      completedAt: "2026-07-15T00:01:00.000Z",
    };

    store.saveCheckpoint(checkpoint);
    store.saveCheckpoint(checkpoint);

    expect(store.getCheckpoint("run_demo", "planning")).toEqual(checkpoint);
    expect(() =>
      store.saveCheckpoint({
        ...checkpoint,
        idempotencyKey: "run_demo:planning:changed",
      }),
    ).toThrow("STEP_ALREADY_COMPLETED");
  });

  it("rejects factual report sections without persisted citations", () => {
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const report = {
      id: "report_demo",
      runId: "run_demo",
      projectId: "project_demo",
      markdown: "## Finding\n\nEvidence Graph keeps exact quotes. [1]",
      sections: [
        {
          id: "section_finding",
          heading: "Finding",
          factual: true,
          markdown: "Evidence Graph keeps exact quotes. [1]",
          citationIds: ["link_exact_quotes"],
        },
      ],
      citations: [
        {
          evidenceLinkId: "link_exact_quotes",
          claimId: "claim_exact_quotes",
          chunkId: "source_primary_interview_chunk_0",
          sourceId: "source_primary_interview",
          quote: "Evidence Graph keeps claims connected to exact quotes",
          sourceUrl: "https://example.com/research",
          sourceTitle: "Product research interview",
        },
      ],
      version: 1,
      createdAt: "2026-07-15T00:02:00.000Z",
    };

    expect(store.saveReport(report)).toEqual(report);
    expect(store.getReport("run_demo")).toEqual(report);
    expect(() =>
      store.saveReport({
        ...report,
        id: "report_invalid",
        sections: [{ ...report.sections[0], citationIds: [] }],
      }),
    ).toThrow("REPORT_CITATION_REQUIRED");
  });

  it("records ordered run log entries idempotently", () => {
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const entry = {
      id: "run_demo:planning:1:started",
      runId: "run_demo",
      step: "planning" as const,
      status: "started" as const,
      attempt: 1,
      timestamp: "2026-07-15T00:03:00.000Z",
    };

    store.appendRunLog(entry);
    store.appendRunLog(entry);

    expect(store.listRunLogs("run_demo")).toEqual([entry]);
  });

  it("stores one validated embedding per source chunk", () => {
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const embedding = {
      chunkId: "source_primary_interview_chunk_0",
      model: "text-embedding-3-small" as const,
      dimensions: 1536 as const,
      vector: Array<number>(1536).fill(0),
    };

    store.saveEmbedding(embedding);
    store.saveEmbedding(embedding);

    expect(store.getEmbedding(embedding.chunkId)).toEqual(embedding);
  });
});

describe("research workflow", () => {
  it("runs the deterministic workflow to a fully cited report", async () => {
    const providers = createFixtureResearchProviders();
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });

    expect(result.run).toMatchObject({ status: "ready", step: "ready" });
    expect(
      result.report?.sections.every(
        (section) => !section.factual || section.citationIds.length > 0,
      ),
    ).toBe(true);
    expect(result.report?.citations.every((citation) => citation.quote.length > 0)).toBe(true);
    expect(result.evidenceLinks.map((link) => link.relation)).toEqual(
      expect.arrayContaining(["supports", "rebuts"]),
    );
    expect(result.completedSteps).toEqual([
      "planning",
      "searching",
      "collecting",
      "indexing",
      "extracting_claims",
      "linking_evidence",
      "detecting_conflicts",
      "drafting_report",
    ]);
  });

  it("returns an already-ready run without provider calls or duplicate entities", async () => {
    const providers = createFixtureResearchProviders();
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const input = {
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    };

    await runResearchWorkflow(input);
    const callsAfterFirstRun = providers.calls.length;
    const snapshotAfterFirstRun = store.getSnapshot();
    const second = await runResearchWorkflow({
      ...input,
      manualSources: Array.from({ length: 6 }, (_, index) => ({
        url: `https://ignored.example.com/source-${index}`,
        title: `Ignored source ${index}`,
        body: `Ignored source body ${index}`,
        sourceType: "article" as const,
      })),
    });
    const snapshotAfterSecondRun = store.getSnapshot();

    expect(second.run).toMatchObject({ status: "ready", step: "ready" });
    expect(providers.calls).toHaveLength(callsAfterFirstRun);
    expect(snapshotAfterSecondRun.sources).toHaveLength(snapshotAfterFirstRun.sources.length);
    expect(snapshotAfterSecondRun.claims).toHaveLength(snapshotAfterFirstRun.claims.length);
    expect(snapshotAfterSecondRun.evidenceLinks).toHaveLength(
      snapshotAfterFirstRun.evidenceLinks.length,
    );
  });

  it("resumes from the first missing checkpoint after a provider failure", async () => {
    const providers = createFixtureResearchProviders({ failOnceAt: "extract_claims" });
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const input = {
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    };

    const failed = await runResearchWorkflow(input);
    const resumed = await runResearchWorkflow(input);
    const operations = providers.calls.map((call) => call.operation);

    expect(failed.run).toMatchObject({
      status: "failed",
      step: "failed",
      errorMessage: "WORKFLOW_FAILED",
    });
    expect(failed.report).toBeUndefined();
    expect(resumed.run).toMatchObject({ status: "ready", step: "ready" });
    expect(operations.filter((operation) => operation === "plan")).toHaveLength(1);
    expect(operations.filter((operation) => operation === "search")).toHaveLength(3);
    expect(operations.filter((operation) => operation === "embed")).toHaveLength(1);
    expect(operations.filter((operation) => operation === "extract_claims")).toHaveLength(2);
    expect(
      store
        .listRunLogs("run_demo")
        .filter((entry) => entry.status === "skipped")
        .map((entry) => entry.step),
    ).toEqual(["planning", "searching", "collecting", "indexing"]);
  });

  it("fails without a report when evidence contains a non-exact quote", async () => {
    const providers = createFixtureResearchProviders({ invalidQuote: true });
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });

    expect(result.run).toMatchObject({
      status: "failed",
      step: "failed",
      errorMessage: "QUOTE_NOT_FOUND",
    });
    expect(result.report).toBeUndefined();
    expect(providers.calls.some((call) => call.operation === "draft_report")).toBe(false);
  });

  it("stops before the next provider call when the run reaches its USD 1 limit", async () => {
    const providers = createFixtureResearchProviders({
      costOverrides: { embed: 0.96 },
    });
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });

    expect(result.run).toMatchObject({
      status: "failed",
      errorMessage: "RUN_COST_LIMIT_EXCEEDED",
      estimatedCostUsd: 1,
    });
    expect(providers.calls.some((call) => call.operation === "extract_claims")).toBe(false);
  });

  it("rejects manual sources above the run limit before provider calls", async () => {
    const providers = createFixtureResearchProviders();
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const manualSources = Array.from({ length: 6 }, (_, index) => ({
      url: `https://manual.example.com/source-${index}`,
      title: `Manual source ${index}`,
      body: `Manual source body ${index}`,
      sourceType: "article" as const,
    }));

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources,
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });

    expect(result.run).toMatchObject({
      status: "failed",
      errorMessage: "MANUAL_URL_LIMIT_EXCEEDED",
    });
    expect(providers.calls).toEqual([]);
  });

  it("rejects collected source text above the run content limit", async () => {
    const fixture = createDemoResearchFixture();
    fixture.researchRuns[0].maxContentChars = 50;
    const providers = createFixtureResearchProviders();
    const store = createInMemoryResearchWorkflowStore(fixture);

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });

    expect(result.run).toMatchObject({
      status: "failed",
      errorMessage: "CONTENT_LIMIT_EXCEEDED",
    });
    expect(providers.calls.some((call) => call.operation === "embed")).toBe(false);
  });

  it("caps deduplicated search sources at the run source limit", async () => {
    const fixture = createDemoResearchFixture();
    fixture.researchRuns[0].sourceLimit = 3;
    const providers = createFixtureResearchProviders({ searchResultCount: 8 });
    const store = createInMemoryResearchWorkflowStore(fixture);

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });
    const collecting = store.getCheckpoint("run_demo", "collecting");

    expect(result.run.status).toBe("ready");
    expect(collecting?.output).toMatchObject({
      sourceIds: expect.arrayContaining([
        "source_primary_interview",
        "source_official_notes",
      ]),
    });
    expect((collecting?.output as { sourceIds: string[] }).sourceIds).toHaveLength(3);
    expect(store.getSnapshot().sources).toHaveLength(3);
  });

  it("blocks a fourth provider attempt for the same failed step", async () => {
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const providersByAttempt = Array.from({ length: 4 }, () =>
      createFixtureResearchProviders({ failOnceAt: "extract_claims" }),
    );
    let lastResult: Awaited<ReturnType<typeof runResearchWorkflow>> | undefined;

    for (const providers of providersByAttempt) {
      lastResult = await runResearchWorkflow({
        runId: "run_demo",
        ownerId: "user_ailian",
        manualSources: [],
        providers,
        store,
        now: () => "2026-07-15T01:00:00.000Z",
      });
    }

    expect(lastResult?.run).toMatchObject({
      status: "failed",
      errorMessage: "STEP_RETRY_LIMIT_EXCEEDED",
    });
    expect(
      providersByAttempt
        .slice(0, 3)
        .flatMap((providers) => providers.calls)
        .filter((call) => call.operation === "extract_claims"),
    ).toHaveLength(3);
    expect(providersByAttempt[3].calls).toEqual([]);
  });

  it("does not leak unknown provider errors into run logs", async () => {
    const providers = createFixtureResearchProviders();
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    providers.languageModel.generateStructured = async () => {
      throw new Error("Private source text from a provider response");
    };

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });
    const serializedLogs = JSON.stringify(store.listRunLogs("run_demo"));

    expect(result.run.errorMessage).toBe("WORKFLOW_FAILED");
    expect(serializedLogs).not.toContain("Private source text");
    expect(serializedLogs).toContain("WORKFLOW_FAILED");
  });

  it("rejects a run owner mismatch without provider calls", async () => {
    const providers = createFixtureResearchProviders();
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());

    await expect(
      runResearchWorkflow({
        runId: "run_demo",
        ownerId: "user_other",
        manualSources: [],
        providers,
        store,
        now: () => "2026-07-15T01:00:00.000Z",
      }),
    ).rejects.toThrow("RUN_NOT_FOUND");
    expect(providers.calls).toEqual([]);
  });
});
