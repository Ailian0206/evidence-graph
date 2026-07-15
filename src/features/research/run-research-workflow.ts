import { z } from "zod";

import { createClaimKey } from "@/features/claims/claim-utils";
import type { EvidenceLink, ResearchRun } from "@/features/research/domain";
import type { InMemoryResearchWorkflowStore } from "@/features/research/workflow-store";
import {
  claimCandidatesSchema,
  conflictCandidatesSchema,
  evidenceCandidatesSchema,
  reportDraftSchema,
  searchPlanSchema,
  type ResearchReport,
  type WorkflowStep,
} from "@/features/research/workflow-types";
import {
  canonicalizeUrl,
  chunkSourceText,
  createContentHash,
  extractDomain,
} from "@/features/sources/source-utils";
import {
  searchResultSchema,
  type EmbeddingProvider,
  type LanguageModel,
  type ProviderUsage,
  type SearchProvider,
  type SearchResult,
} from "@/providers/contracts";

type ResearchWorkflowProviders = {
  search: SearchProvider;
  languageModel: LanguageModel;
  embedding: EmbeddingProvider;
};

type RunResearchWorkflowInput = {
  runId: string;
  ownerId: string;
  manualSources: SearchResult[];
  providers: ResearchWorkflowProviders;
  store: InMemoryResearchWorkflowStore;
  now: () => string;
};

type ResearchWorkflowResult = {
  run: ResearchRun;
  report: ResearchReport;
  evidenceLinks: EvidenceLink[];
  completedSteps: WorkflowStep[];
};

const searchOutputSchema = z.object({ results: searchResultSchema.array() });
const sourceOutputSchema = z.object({ sourceIds: z.array(z.string().min(1)) });
const chunkOutputSchema = z.object({ chunkIds: z.array(z.string().min(1)) });
const evidenceOutputSchema = z.object({ evidenceLinkIds: z.array(z.string().min(1)) });
const relationOutputSchema = z.object({ claimRelationIds: z.array(z.string().min(1)) });
const reportOutputSchema = z.object({ reportId: z.string().min(1) });

const createSourceId = (contentHash: string) =>
  `source_${contentHash.replace("sha256_", "").slice(0, 20)}`;

const roundCost = (cost: number) => Math.round(cost * 1_000_000) / 1_000_000;

export const runResearchWorkflow = async ({
  runId,
  ownerId,
  manualSources,
  providers,
  store,
  now,
}: RunResearchWorkflowInput): Promise<ResearchWorkflowResult> => {
  let run = store.requireRun({ runId, ownerId });
  const completedSteps: WorkflowStep[] = [];
  const project = store
    .getSnapshot()
    .projects.find((candidate) => candidate.id === run.projectId);

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const applyUsage = (usage: ProviderUsage) => {
    run = store.updateRun({
      ...run,
      estimatedCostUsd: roundCost(run.estimatedCostUsd + usage.estimatedCostUsd),
      searchCount: run.searchCount + usage.searchCount,
      tokenCount: run.tokenCount + usage.tokenCount,
      updatedAt: now(),
    });
  };

  const executeStep = async <T>(
    step: WorkflowStep,
    schema: z.ZodType<T>,
    execute: (idempotencyKey: string) => Promise<T>,
  ): Promise<T> => {
    const checkpoint = store.getCheckpoint(runId, step);

    if (checkpoint) {
      completedSteps.push(step);
      return schema.parse(checkpoint.output);
    }

    const idempotencyKey = `${runId}:${step}`;
    run = store.updateRun({
      ...run,
      status: "running",
      step,
      errorMessage: undefined,
      updatedAt: now(),
    });
    store.appendRunLog({
      id: `${idempotencyKey}:1:0_started`,
      runId,
      step,
      status: "started",
      attempt: 1,
      timestamp: now(),
    });

    const output = schema.parse(await execute(idempotencyKey));
    store.saveCheckpoint({
      runId,
      step,
      idempotencyKey,
      output,
      completedAt: now(),
    });
    store.appendRunLog({
      id: `${idempotencyKey}:1:1_completed`,
      runId,
      step,
      status: "completed",
      attempt: 1,
      timestamp: now(),
    });
    completedSteps.push(step);
    return output;
  };

  const plan = await executeStep("planning", searchPlanSchema, async (idempotencyKey) => {
    const result = await providers.languageModel.generateStructured({
      operation: "plan",
      schema: searchPlanSchema,
      payload: { question: project.question },
      idempotencyKey,
    });
    applyUsage(result.usage);
    return searchPlanSchema.parse(result.data);
  });

  const searchOutput = await executeStep(
    "searching",
    searchOutputSchema,
    async (idempotencyKey) => {
      const results: SearchResult[] = [];

      for (const [queryIndex, query] of plan.queries.entries()) {
        const result = await providers.search.search({
          query,
          maxResults: run.sourceLimit,
          idempotencyKey: `${idempotencyKey}:${queryIndex}`,
        });
        applyUsage(result.usage);
        results.push(...searchResultSchema.array().parse(result.data));
      }

      return { results };
    },
  );

  const collected = await executeStep(
    "collecting",
    sourceOutputSchema,
    async () => {
      const canonicalUrls = new Set<string>();
      const contentHashes = new Set<string>();
      const sourceIds: string[] = [];

      for (const candidate of [...manualSources, ...searchOutput.results]) {
        const parsed = searchResultSchema.parse(candidate);
        const canonicalUrl = canonicalizeUrl(parsed.url);
        const contentHash = createContentHash(parsed.body);

        if (canonicalUrls.has(canonicalUrl) || contentHashes.has(contentHash)) {
          continue;
        }

        canonicalUrls.add(canonicalUrl);
        contentHashes.add(contentHash);

        const source = store.upsertSource({
          id: createSourceId(contentHash),
          projectId: run.projectId,
          canonicalUrl,
          title: parsed.title,
          author: parsed.author,
          publishedAt: parsed.publishedAt,
          domain: extractDomain(canonicalUrl),
          sourceType: parsed.sourceType,
          body: parsed.body,
          contentHash,
          retrievedAt: now(),
        });
        sourceIds.push(source.id);

        if (sourceIds.length === run.sourceLimit) {
          break;
        }
      }

      return { sourceIds };
    },
  );

  const indexed = await executeStep("indexing", chunkOutputSchema, async (idempotencyKey) => {
    const snapshot = store.getSnapshot();
    const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
    const chunkById = new Map(
      collected.sourceIds.flatMap((sourceId) => {
        const source = sourceById.get(sourceId);

        if (!source) {
          throw new Error("SOURCE_NOT_FOUND");
        }

        return chunkSourceText({
          sourceId: source.id,
          projectId: source.projectId,
          text: source.body,
        }).map((chunk) => {
          const saved = store.upsertChunk(chunk);
          return [saved.id, saved] as const;
        });
      }),
    );
    const chunks = Array.from(chunkById.values());
    const missingEmbeddings = chunks.filter((chunk) => !store.getEmbedding(chunk.id));

    if (missingEmbeddings.length > 0) {
      const result = await providers.embedding.embed({
        texts: missingEmbeddings.map((chunk) => chunk.text),
        idempotencyKey,
      });
      applyUsage(result.usage);
      const vectors = z
        .array(z.array(z.number()).length(1536))
        .length(missingEmbeddings.length)
        .parse(result.data);

      for (const [index, chunk] of missingEmbeddings.entries()) {
        store.saveEmbedding({
          chunkId: chunk.id,
          model: "text-embedding-3-small",
          dimensions: 1536,
          vector: vectors[index],
        });
      }
    }

    return { chunkIds: chunks.map((chunk) => chunk.id) };
  });

  const extractedClaims = await executeStep(
    "extracting_claims",
    claimCandidatesSchema,
    async (idempotencyKey) => {
      const snapshot = store.getSnapshot();
      const chunks = snapshot.chunks.filter((chunk) => indexed.chunkIds.includes(chunk.id));
      const result = await providers.languageModel.generateStructured({
        operation: "extract_claims",
        schema: claimCandidatesSchema,
        payload: { chunks },
        idempotencyKey,
      });
      applyUsage(result.usage);
      const output = claimCandidatesSchema.parse(result.data);

      for (const candidate of output.claims) {
        store.upsertClaim({
          id: candidate.candidateId,
          projectId: run.projectId,
          statement: candidate.statement,
          normalizedKey: createClaimKey(candidate.statement),
          claimType: candidate.claimType,
          qualifiers: candidate.qualifiers,
          confidence: candidate.confidence,
          reviewStatus: "pending",
          createdAt: now(),
        });
      }

      return output;
    },
  );

  const linkedEvidence = await executeStep(
    "linking_evidence",
    evidenceOutputSchema,
    async (idempotencyKey) => {
      const result = await providers.languageModel.generateStructured({
        operation: "link_evidence",
        schema: evidenceCandidatesSchema,
        payload: { claims: extractedClaims.claims, chunkIds: indexed.chunkIds },
        idempotencyKey,
      });
      applyUsage(result.usage);
      const output = evidenceCandidatesSchema.parse(result.data);
      const snapshot = store.getSnapshot();
      const sourceByUrl = new Map(
        snapshot.sources.map((source) => [source.canonicalUrl, source]),
      );
      const evidenceLinkIds = output.evidence.map((candidate) => {
        const source = sourceByUrl.get(canonicalizeUrl(candidate.sourceUrl));
        const chunk = snapshot.chunks.find(
          (current) =>
            current.sourceId === source?.id && current.text.includes(candidate.quote),
        );

        if (!source || !chunk) {
          throw new Error("QUOTE_NOT_FOUND");
        }

        return store.upsertEvidenceLink({
          id: `link_${candidate.claimCandidateId}_${candidate.relation}`,
          projectId: run.projectId,
          claimId: candidate.claimCandidateId,
          chunkId: chunk.id,
          relation: candidate.relation,
          strength: candidate.strength,
          quote: candidate.quote,
          rationale: candidate.rationale,
        }).id;
      });

      return { evidenceLinkIds };
    },
  );

  await executeStep(
    "detecting_conflicts",
    relationOutputSchema,
    async (idempotencyKey) => {
      const result = await providers.languageModel.generateStructured({
        operation: "detect_conflicts",
        schema: conflictCandidatesSchema,
        payload: { claims: extractedClaims.claims },
        idempotencyKey,
      });
      applyUsage(result.usage);
      const output = conflictCandidatesSchema.parse(result.data);
      const claimRelationIds = output.relations.map((candidate) =>
        store.upsertClaimRelation({
          id: `relation_${candidate.fromClaimCandidateId}_${candidate.toClaimCandidateId}_${candidate.relation}`,
          projectId: run.projectId,
          fromClaimId: candidate.fromClaimCandidateId,
          toClaimId: candidate.toClaimCandidateId,
          relation: candidate.relation,
          rationale: candidate.rationale,
        }).id,
      );

      return { claimRelationIds };
    },
  );

  const drafted = await executeStep(
    "drafting_report",
    reportOutputSchema,
    async (idempotencyKey) => {
      const result = await providers.languageModel.generateStructured({
        operation: "draft_report",
        schema: reportDraftSchema,
        payload: { claims: extractedClaims.claims, evidenceLinkIds: linkedEvidence.evidenceLinkIds },
        idempotencyKey,
      });
      applyUsage(result.usage);
      const output = reportDraftSchema.parse(result.data);
      const snapshot = store.getSnapshot();
      const evidenceByClaim = new Map<string, EvidenceLink[]>();

      for (const link of snapshot.evidenceLinks) {
        const current = evidenceByClaim.get(link.claimId) ?? [];
        current.push(link);
        evidenceByClaim.set(link.claimId, current);
      }

      const sections = output.sections.map((section) => ({
        id: section.id,
        heading: section.heading,
        factual: section.factual,
        markdown: section.markdown,
        citationIds: section.claimIds.flatMap((claimId) =>
          (evidenceByClaim.get(claimId) ?? []).map((link) => link.id),
        ),
      }));
      const citationLinkIds = new Set(sections.flatMap((section) => section.citationIds));
      const chunkById = new Map(snapshot.chunks.map((chunk) => [chunk.id, chunk]));
      const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
      const citations = snapshot.evidenceLinks
        .filter((link) => citationLinkIds.has(link.id))
        .map((link) => {
          const chunk = chunkById.get(link.chunkId);
          const source = chunk ? sourceById.get(chunk.sourceId) : undefined;

          if (!chunk || !source) {
            throw new Error("REPORT_CITATION_INVALID");
          }

          return {
            evidenceLinkId: link.id,
            claimId: link.claimId,
            chunkId: chunk.id,
            sourceId: source.id,
            quote: link.quote,
            sourceUrl: source.canonicalUrl,
            sourceTitle: source.title,
          };
        });
      const report = store.saveReport({
        id: `report_${runId}`,
        runId,
        projectId: run.projectId,
        markdown: sections
          .map((section) => `## ${section.heading}\n\n${section.markdown}`)
          .join("\n\n"),
        sections,
        citations,
        version: 1,
        createdAt: now(),
      });

      return { reportId: report.id };
    },
  );

  const report = store.getReport(runId);

  if (!report || report.id !== drafted.reportId) {
    throw new Error("REPORT_NOT_FOUND");
  }

  run = store.updateRun({
    ...run,
    status: "ready",
    step: "ready",
    errorMessage: undefined,
    updatedAt: now(),
  });

  return {
    run,
    report,
    evidenceLinks: store
      .getSnapshot()
      .evidenceLinks.filter((link) => link.projectId === run.projectId),
    completedSteps,
  };
};
