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

  it("preserves initialized claim relations", () => {
    const fixture = createDemoResearchFixture();
    const relatedClaim = {
      ...fixture.claims[0],
      id: "claim_related",
      statement: "Cited reports depend on exact-quote traceability.",
      normalizedKey: "cited reports depend on exact quote traceability",
    };
    const relation = {
      id: "relation_initialized",
      projectId: fixture.projects[0].id,
      fromClaimId: fixture.claims[0].id,
      toClaimId: relatedClaim.id,
      relation: "depends_on" as const,
      rationale: "The report claim depends on the traceability claim.",
    };
    fixture.claims.push(relatedClaim);
    fixture.claimRelations.push(relation);

    const store = createInMemoryResearchWorkflowStore(fixture);

    expect(store.getSnapshot().claimRelations).toEqual([relation]);
  });

  it("rejects duplicate fixture entity IDs before map initialization", () => {
    const sourceFixture = createDemoResearchFixture();
    const otherProject = {
      ...sourceFixture.projects[0],
      id: "project_other",
      slug: "other-project",
    };
    sourceFixture.projects.push(otherProject);
    sourceFixture.sources.push({
      ...sourceFixture.sources[0],
      projectId: otherProject.id,
      canonicalUrl: "https://other.example.com/research",
      contentHash: "sha256_other_source",
    });

    const claimFixture = createDemoResearchFixture();
    claimFixture.projects.push(otherProject);
    claimFixture.claims.push({
      ...claimFixture.claims[0],
      projectId: otherProject.id,
      normalizedKey: "other project claim",
    });

    expect(() => createInMemoryResearchWorkflowStore(sourceFixture)).toThrow(
      "ENTITY_ID_CONFLICT",
    );
    expect(() => createInMemoryResearchWorkflowStore(claimFixture)).toThrow(
      "ENTITY_ID_CONFLICT",
    );
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

  it("rejects cross-project reuse of global entity IDs", () => {
    const fixture = createDemoResearchFixture();
    const otherProject = {
      ...fixture.projects[0],
      id: "project_other",
      slug: "other-project",
    };
    fixture.projects.push(otherProject);
    const store = createInMemoryResearchWorkflowStore(fixture);

    expect(() =>
      store.upsertSource({
        ...fixture.sources[0],
        projectId: otherProject.id,
        canonicalUrl: "https://other.example.com/research",
        contentHash: "sha256_other_source",
      }),
    ).toThrow("ENTITY_ID_CONFLICT");
    expect(() =>
      store.upsertClaim({
        ...fixture.claims[0],
        projectId: otherProject.id,
        normalizedKey: "other claim",
      }),
    ).toThrow("ENTITY_ID_CONFLICT");
  });

  it("rejects report citations from another project", () => {
    const fixture = createDemoResearchFixture();
    const otherProject = {
      ...fixture.projects[0],
      id: "project_other",
      slug: "other-project",
    };
    fixture.projects.push(otherProject);
    const store = createInMemoryResearchWorkflowStore(fixture);
    const source = store.upsertSource({
      ...fixture.sources[0],
      id: "source_other",
      projectId: otherProject.id,
      canonicalUrl: "https://other.example.com/research",
      contentHash: "sha256_other_source",
    });
    const chunk = store.upsertChunk({
      ...fixture.chunks[0],
      id: "source_other_chunk_0",
      sourceId: source.id,
      projectId: otherProject.id,
    });
    const claim = store.upsertClaim({
      ...fixture.claims[0],
      id: "claim_other",
      projectId: otherProject.id,
      normalizedKey: "other claim",
    });
    const link = store.upsertEvidenceLink({
      ...fixture.evidenceLinks[0],
      id: "link_other",
      projectId: otherProject.id,
      claimId: claim.id,
      chunkId: chunk.id,
    });

    expect(() =>
      store.saveReport({
        id: "report_cross_project",
        runId: "run_demo",
        projectId: "project_demo",
        markdown: "## Cross-project citation\n\nThis must be rejected. [1]",
        sections: [
          {
            id: "section_cross_project",
            heading: "Cross-project citation",
            factual: true,
            markdown: "This must be rejected. [1]",
            citationIds: [link.id],
          },
        ],
        citations: [
          {
            evidenceLinkId: link.id,
            claimId: claim.id,
            chunkId: chunk.id,
            sourceId: source.id,
            quote: link.quote,
            sourceUrl: source.canonicalUrl,
            sourceTitle: source.title,
          },
        ],
        version: 1,
        createdAt: "2026-07-15T00:04:00.000Z",
      }),
    ).toThrow("REPORT_CITATION_INVALID");
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

  it("rejects state and checkpoint mutations after a run is ready", () => {
    const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());
    const run = store.requireRun({ runId: "run_demo", ownerId: "user_ailian" });
    const readyRun = store.updateRun({ ...run, status: "ready", step: "ready" });

    expect(() =>
      store.updateRun({ ...readyRun, status: "running", step: "planning" }),
    ).toThrow("RUN_IMMUTABLE");
    expect(() =>
      store.saveCheckpoint({
        runId: readyRun.id,
        step: "planning",
        idempotencyKey: "run_demo:planning",
        output: { queries: [] },
        completedAt: "2026-07-15T00:05:00.000Z",
      }),
    ).toThrow("RUN_IMMUTABLE");
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
    const fixture = createDemoResearchFixture();
    fixture.sources = [];
    fixture.chunks = [];
    fixture.claims = [];
    fixture.evidenceLinks = [];
    fixture.claimRelations = [];
    const store = createInMemoryResearchWorkflowStore(fixture);

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
    expect(
      result.evidenceLinks.every((link) => link.claimId.startsWith("claim_project_demo_")),
    ).toBe(true);
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

  it("drafts only supported claims and cites every factual paragraph", async () => {
    const providers = createFixtureResearchProviders({ evidenceCount: 1 });
    const fixture = createDemoResearchFixture();
    fixture.sources = [];
    fixture.chunks = [];
    fixture.claims = [];
    fixture.evidenceLinks = [];
    fixture.claimRelations = [];
    const store = createInMemoryResearchWorkflowStore(fixture);

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });
    const draftCall = providers.calls.find((call) => call.operation === "draft_report");
    const draftClaims = (draftCall?.payload as { claims: Array<{ candidateId: string }> })
      .claims;

    expect(result.run.status).toBe("ready");
    expect(draftClaims.map((claim) => claim.candidateId)).toEqual(["claim_exact_quotes"]);
    expect(result.report?.sections).toHaveLength(1);
    for (const section of result.report?.sections ?? []) {
      for (const paragraph of section.markdown.split("\n\n")) {
        expect(section.citationIds.some((citationId) => paragraph.includes(`[${citationId}]`))).toBe(
          true,
        );
      }
    }
  });

  it("rejects a report section that mixes supported and unsupported claims", async () => {
    const providers = createFixtureResearchProviders({
      evidenceCount: 1,
      mixedUnsupportedReportClaim: true,
    });
    const fixture = createDemoResearchFixture();
    fixture.sources = [];
    fixture.chunks = [];
    fixture.claims = [];
    fixture.evidenceLinks = [];
    fixture.claimRelations = [];
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
      errorMessage: "REPORT_CITATION_INVALID",
    });
    expect(result.report).toBeUndefined();
  });

  it("resolves evidence sources inside the run project when URLs overlap", async () => {
    const fixture = createDemoResearchFixture();
    const otherProject = {
      ...fixture.projects[0],
      id: "project_other",
      slug: "other-project",
    };
    const otherSource = {
      ...fixture.sources[0],
      id: "source_other",
      projectId: otherProject.id,
      contentHash: "sha256_other_source",
    };
    const otherChunk = {
      ...fixture.chunks[0],
      id: "source_other_chunk_0",
      sourceId: otherSource.id,
      projectId: otherProject.id,
    };
    fixture.projects.push(otherProject);
    fixture.sources.push(otherSource);
    fixture.chunks.push(otherChunk);
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

    expect(result.run.status).toBe("ready");
    expect(result.evidenceLinks.every((link) => link.projectId === "project_demo")).toBe(true);
  });

  it("keeps multiple same-relation citations for one claim", async () => {
    const providers = createFixtureResearchProviders({ additionalSupportingEvidence: true });
    const fixture = createDemoResearchFixture();
    fixture.sources = [];
    fixture.chunks = [];
    fixture.claims = [];
    fixture.evidenceLinks = [];
    fixture.claimRelations = [];
    const store = createInMemoryResearchWorkflowStore(fixture);

    const result = await runResearchWorkflow({
      runId: "run_demo",
      ownerId: "user_ailian",
      manualSources: [],
      providers,
      store,
      now: () => "2026-07-15T01:00:00.000Z",
    });
    const supportingLinks = result.evidenceLinks.filter(
      (link) => link.claimId.endsWith("claim_exact_quotes") && link.relation === "supports",
    );

    expect(result.run.status).toBe("ready");
    expect(supportingLinks).toHaveLength(2);
    expect(new Set(supportingLinks.map((link) => link.id))).toHaveLength(2);
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
    expect(
      store
        .listRunLogs("run_demo")
        .filter((entry) => entry.status === "skipped")
        .every((entry) => entry.attempt === 1),
    ).toBe(true);
  });

  it("does not double-count usage when a partial search step retries", async () => {
    const providers = createFixtureResearchProviders({ failSearchAtCall: 2 });
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

    expect(failed.run.status).toBe("failed");
    expect(resumed.run).toMatchObject({
      status: "ready",
      estimatedCostUsd: 0.081,
      searchCount: 3,
    });
    expect(providers.calls.filter((call) => call.operation === "search")).toHaveLength(5);
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

  it("records paid usage when one provider call exceeds the cost limit", async () => {
    const providers = createFixtureResearchProviders({
      costOverrides: { plan: 1.1 },
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
      tokenCount: 120,
    });
    expect(store.getSnapshot().providerUsages).toHaveLength(1);
    expect(providers.calls.some((call) => call.operation === "search")).toBe(false);
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
    expect(store.listRunLogs("run_demo")).toContainEqual(
      expect.objectContaining({
        step: "planning",
        status: "failed",
        attempt: 1,
        errorCode: "MANUAL_URL_LIMIT_EXCEEDED",
      }),
    );
  });

  it("rejects collected source text above the run content limit", async () => {
    const fixture = createDemoResearchFixture();
    fixture.researchRuns[0].maxContentChars = 50;
    fixture.sources = [];
    fixture.chunks = [];
    fixture.claims = [];
    fixture.evidenceLinks = [];
    fixture.claimRelations = [];
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
    expect(store.getSnapshot().sources).toEqual([]);
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
    expect(store.listRunLogs("run_demo")).toContainEqual(
      expect.objectContaining({
        step: "extracting_claims",
        status: "failed",
        attempt: 4,
        errorCode: "STEP_RETRY_LIMIT_EXCEEDED",
      }),
    );
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

  it("rejects a run whose project belongs to another owner", async () => {
    const fixture = createDemoResearchFixture();
    fixture.projects[0].ownerId = "user_other";
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
      errorMessage: "RUN_NOT_FOUND",
    });
    expect(providers.calls).toEqual([]);
  });

  it("rejects a ready run before report access when project ownership mismatches", async () => {
    const fixture = createDemoResearchFixture();
    fixture.projects[0].ownerId = "user_other";
    fixture.researchRuns[0].status = "ready";
    fixture.researchRuns[0].step = "ready";
    const providers = createFixtureResearchProviders();
    const store = createInMemoryResearchWorkflowStore(fixture);

    await expect(
      runResearchWorkflow({
        runId: "run_demo",
        ownerId: "user_ailian",
        manualSources: [],
        providers,
        store,
        now: () => "2026-07-15T01:00:00.000Z",
      }),
    ).rejects.toThrow("RUN_NOT_FOUND");
    expect(store.getSnapshot().runs[0]).toMatchObject({ status: "ready", step: "ready" });
    expect(providers.calls).toEqual([]);
  });
});
