import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createLiveEvidenceEvalBudget,
  liveEvidenceEvalConstants,
  readLiveEvidenceEvalEnvironment,
} from "@/features/evaluation/live-evidence-eval-gate";
import {
  EVIDENCE_EVAL_MANIFEST_VERSION,
  evidenceEvalManifest,
} from "@/features/evaluation/evidence-eval-manifest";
import { createDemoResearchFixture } from "@/features/research/fixtures";
import { runResearchWorkflow } from "@/features/research/run-research-workflow";
import { createInMemoryResearchWorkflowStore } from "@/features/research/workflow-store";
import { createResearchProviders } from "@/providers/runtime";

const OUTPUT_PATH = resolve("output/evidence-eval/live-collection.json");
const OWNER_ID = "evidence_eval_agent";
const MAX_EVAL_CONTENT_CHARS = 12_000;

const writePrivateJson = async (value: unknown) => {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(OUTPUT_PATH, 0o600);
};

describe("live Evidence Eval collection", () => {
  it("collects the ten fixed questions within the approved aggregate budget", async () => {
    const { totalCostLimitUsd, previousEstimatedCostUsd } =
      readLiveEvidenceEvalEnvironment();
    const budget = createLiveEvidenceEvalBudget({
      runCount: evidenceEvalManifest.length,
      totalCostLimitUsd,
      previousEstimatedCostUsd,
    });
    const providers = createResearchProviders();
    const collection = {
      manifestVersion: EVIDENCE_EVAL_MANIFEST_VERSION,
      approvedTotalCostUsd: totalCostLimitUsd,
      previousEstimatedCostUsd,
      perRunCostLimitUsd: budget.perRunCostLimitUsd,
      totalEstimatedCostUsd: previousEstimatedCostUsd,
      observation: {
        manifestVersion: EVIDENCE_EVAL_MANIFEST_VERSION,
        cases: [] as Array<Record<string, unknown>>,
      },
      relationReview: [] as Array<Record<string, unknown>>,
    };

    for (const manifestItem of evidenceEvalManifest) {
      const fixture = createDemoResearchFixture();
      const projectId = `eval_project_${manifestItem.id}`;
      const runId = `eval_run_${manifestItem.id}`;
      fixture.projects = [
        {
          ...fixture.projects[0],
          id: projectId,
          ownerId: OWNER_ID,
          title: `Evidence Eval: ${manifestItem.id}`,
          question: manifestItem.question,
          language: manifestItem.language,
          slug: `evidence-eval-${manifestItem.id}`,
        },
      ];
      fixture.researchRuns = [
        {
          ...fixture.researchRuns[0],
          id: runId,
          projectId,
          ownerId: OWNER_ID,
          sourceLimit: providers.executionLimits?.sourceLimit ?? 4,
          maxContentChars: Math.min(
            providers.executionLimits?.maxContentChars ?? MAX_EVAL_CONTENT_CHARS,
            MAX_EVAL_CONTENT_CHARS,
          ),
        },
      ];
      fixture.sources = [];
      fixture.chunks = [];
      fixture.claims = [];
      fixture.evidenceLinks = [];
      fixture.claimRelations = [];
      const store = createInMemoryResearchWorkflowStore(fixture);
      const result = await runResearchWorkflow({
        runId,
        ownerId: OWNER_ID,
        manualSources: [],
        providers,
        maxCostUsd: budget.perRunCostLimitUsd,
        maxEmbeddingBatches: providers.executionLimits?.maxEmbeddingBatches,
        maxSearchQueries: 2,
        minimumEvidenceDomains:
          liveEvidenceEvalConstants.workflowMinimumEvidenceDomains,
        store,
        now: () => new Date().toISOString(),
      });
      const snapshot = store.getSnapshot();
      budget.recordRunCost(result.run.estimatedCostUsd);
      const collectedSources = snapshot.sources.filter(
        (source) => source.projectId === projectId,
      );
      const indexedChunks = snapshot.chunks.filter(
        (chunk) => chunk.projectId === projectId,
      );
      const links = snapshot.evidenceLinks.filter(
        (link) => link.projectId === projectId,
      );
      const linkedChunkIds = new Set(links.map((link) => link.chunkId));
      const chunks = snapshot.chunks.filter((chunk) => linkedChunkIds.has(chunk.id));
      const linkedSourceIds = new Set(chunks.map((chunk) => chunk.sourceId));
      const sources = snapshot.sources.filter((source) => linkedSourceIds.has(source.id));
      const claimsById = new Map(snapshot.claims.map((claim) => [claim.id, claim]));
      const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
      const sourcesById = new Map(sources.map((source) => [source.id, source]));

      collection.observation.cases.push({
        caseId: manifestItem.id,
        category: manifestItem.category,
        language: manifestItem.language,
        question: manifestItem.question,
        usableScenario: true,
        run: {
          id: result.run.id,
          status: result.run.status,
          estimatedCostUsd: result.run.estimatedCostUsd,
          errorMessage: result.run.errorMessage,
          completedSteps: result.completedSteps,
        },
        collectionStats: {
          sourceCount: collectedSources.length,
          chunkCount: indexedChunks.length,
          domainCount: new Set(collectedSources.map((source) => source.domain)).size,
        },
        sources: sources.map((source) => ({ id: source.id, domain: source.domain })),
        chunks: chunks.map((chunk) => ({
          id: chunk.id,
          sourceId: chunk.sourceId,
          text: chunk.text,
        })),
        evidenceLinks: links.map((link) => ({
          id: link.id,
          claimId: link.claimId,
          chunkId: link.chunkId,
          relation: link.relation,
          quote: link.quote,
        })),
        reports: result.report
          ? [
              {
                id: result.report.id,
                paragraphs: result.report.sections.map((section) => ({
                  id: section.id,
                  factual: section.factual,
                  citationIds: section.citationIds,
                })),
              },
            ]
          : [],
        relationSamples: [],
      });

      for (const link of links) {
        const chunk = chunksById.get(link.chunkId);
        const source = chunk ? sourcesById.get(chunk.sourceId) : undefined;
        collection.relationReview.push({
          caseId: manifestItem.id,
          runId,
          evidenceLinkId: link.id,
          claimId: link.claimId,
          claim: claimsById.get(link.claimId)?.statement,
          actualRelation: link.relation,
          expectedRelation: null,
          quote: link.quote,
          rationale: link.rationale,
          sourceTitle: source?.title,
          sourceUrl: source?.canonicalUrl,
        });
      }

      collection.totalEstimatedCostUsd = budget.totalEstimatedCostUsd;
      await writePrivateJson(collection);
      console.log(
        `[evidence-eval-live] ${manifestItem.id} ${result.run.status} cost=${result.run.estimatedCostUsd.toFixed(6)} total=${budget.totalEstimatedCostUsd.toFixed(6)}`,
      );

      if (result.run.status !== "ready") {
        throw new Error(result.run.errorMessage ?? "EVIDENCE_EVAL_RUN_FAILED");
      }
    }

    expect(collection.observation.cases).toHaveLength(evidenceEvalManifest.length);
    expect(budget.totalEstimatedCostUsd).toBeLessThanOrEqual(totalCostLimitUsd);
    expect(OUTPUT_PATH).toContain("output/evidence-eval/live-collection.json");
  });
});
