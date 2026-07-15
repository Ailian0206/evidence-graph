import { z } from "zod";

import { createClaimKey } from "@/features/claims/claim-utils";
import type { EvidenceLink, ResearchRun, Source } from "@/features/research/domain";
import type { InMemoryResearchWorkflowStore } from "@/features/research/workflow-store";
import {
  claimCandidatesSchema,
  conflictCandidatesSchema,
  evidenceCandidatesSchema,
  extractedClaimsOutputSchema,
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
  report: ResearchReport | undefined;
  evidenceLinks: EvidenceLink[];
  completedSteps: WorkflowStep[];
};

const searchOutputSchema = z.object({ results: searchResultSchema.array() });
const sourceOutputSchema = z.object({ sourceIds: z.array(z.string().min(1)) });
const chunkOutputSchema = z.object({ chunkIds: z.array(z.string().min(1)) });
const evidenceOutputSchema = z.object({ evidenceLinkIds: z.array(z.string().min(1)) });
const relationOutputSchema = z.object({ claimRelationIds: z.array(z.string().min(1)) });
const reportOutputSchema = z.object({ reportId: z.string().min(1) });
const WORKFLOW_STEPS: WorkflowStep[] = [
  "planning",
  "searching",
  "collecting",
  "indexing",
  "extracting_claims",
  "linking_evidence",
  "detecting_conflicts",
  "drafting_report",
];
const KNOWN_WORKFLOW_ERRORS = new Set([
  "CONTENT_LIMIT_EXCEEDED",
  "MANUAL_URL_LIMIT_EXCEEDED",
  "PROJECT_NOT_FOUND",
  "QUOTE_NOT_FOUND",
  "REPORT_CITATION_INVALID",
  "REPORT_NOT_FOUND",
  "RUN_COST_LIMIT_EXCEEDED",
  "RUN_NOT_FOUND",
  "SOURCE_NOT_FOUND",
  "STEP_RETRY_LIMIT_EXCEEDED",
]);

const createSourceId = (projectId: string, contentHash: string) =>
  `source_${projectId}_${contentHash.replace("sha256_", "").slice(0, 20)}`;
const createClaimId = (projectId: string, candidateId: string) =>
  `claim_${projectId}_${candidateId}`;

const roundCost = (cost: number) => Math.round(cost * 1_000_000) / 1_000_000;

const runResearchWorkflowAttempt = async ({
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

  if (!project || project.ownerId !== ownerId || project.ownerId !== run.ownerId) {
    throw new Error("RUN_NOT_FOUND");
  }

  if (run.status === "ready") {
    const report = store.getReport(runId);

    if (!report) {
      throw new Error("REPORT_NOT_FOUND");
    }

    return {
      run,
      report,
      evidenceLinks: store
        .getSnapshot()
        .evidenceLinks.filter((link) => link.projectId === run.projectId),
      completedSteps: WORKFLOW_STEPS.filter((step) => store.getCheckpoint(runId, step)),
    };
  }

  if (manualSources.length > run.manualUrlLimit) {
    run = store.updateRun({
      ...run,
      status: "running",
      step: "planning",
      updatedAt: now(),
    });
    throw new Error("MANUAL_URL_LIMIT_EXCEEDED");
  }

  const applyUsage = (idempotencyKey: string, usage: ProviderUsage) => {
    if (!store.saveProviderUsage(idempotencyKey, usage)) {
      return;
    }

    const nextCost = roundCost(run.estimatedCostUsd + usage.estimatedCostUsd);
    run = store.updateRun({
      ...run,
      estimatedCostUsd: Math.min(nextCost, 1),
      searchCount: run.searchCount + usage.searchCount,
      tokenCount: run.tokenCount + usage.tokenCount,
      updatedAt: now(),
    });

    if (nextCost > 1) {
      throw new Error("RUN_COST_LIMIT_EXCEEDED");
    }
  };

  const assertProviderBudget = () => {
    if (run.estimatedCostUsd >= 1) {
      throw new Error("RUN_COST_LIMIT_EXCEEDED");
    }
  };

  const executeStep = async <T>(
    step: WorkflowStep,
    schema: z.ZodType<T>,
    execute: (idempotencyKey: string) => Promise<T>,
  ): Promise<T> => {
    const checkpoint = store.getCheckpoint(runId, step);
    const stepLogs = store.listRunLogs(runId).filter((entry) => entry.step === step);

    if (checkpoint) {
      const skippedSequence = stepLogs.filter((entry) => entry.status === "skipped").length + 1;
      const completedAttempt =
        stepLogs.filter((entry) => entry.status === "started").length || 1;
      store.appendRunLog({
        id: `${runId}:${step}:skip_${skippedSequence}`,
        runId,
        step,
        status: "skipped",
        attempt: completedAttempt,
        timestamp: now(),
      });
      completedSteps.push(step);
      return schema.parse(checkpoint.output);
    }

    const idempotencyKey = `${runId}:${step}`;
    const attempt = stepLogs.filter((entry) => entry.status === "started").length + 1;

    if (attempt > 3) {
      run = store.updateRun({
        ...run,
        status: "running",
        step,
        updatedAt: now(),
      });
      throw new Error("STEP_RETRY_LIMIT_EXCEEDED");
    }

    run = store.updateRun({
      ...run,
      status: "running",
      step,
      errorMessage: undefined,
      updatedAt: now(),
    });
    store.appendRunLog({
      id: `${idempotencyKey}:${attempt}:0_started`,
      runId,
      step,
      status: "started",
      attempt,
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
      id: `${idempotencyKey}:${attempt}:1_completed`,
      runId,
      step,
      status: "completed",
      attempt,
      timestamp: now(),
    });
    completedSteps.push(step);
    return output;
  };

  const plan = await executeStep("planning", searchPlanSchema, async (idempotencyKey) => {
    assertProviderBudget();
    const result = await providers.languageModel.generateStructured({
      operation: "plan",
      schema: searchPlanSchema,
      payload: { question: project.question },
      idempotencyKey,
    });
    applyUsage(idempotencyKey, result.usage);
    return searchPlanSchema.parse(result.data);
  });

  const searchOutput = await executeStep(
    "searching",
    searchOutputSchema,
    async (idempotencyKey) => {
      const results: SearchResult[] = [];

      for (const [queryIndex, query] of plan.queries.entries()) {
        assertProviderBudget();
        const result = await providers.search.search({
          query,
          maxResults: run.sourceLimit,
          idempotencyKey: `${idempotencyKey}:${queryIndex}`,
        });
        applyUsage(`${idempotencyKey}:${queryIndex}`, result.usage);
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
      const currentSources = store
        .getSnapshot()
        .sources.filter((source) => source.projectId === run.projectId);
      const selectedSources: Source[] = [];
      const pendingSources: Source[] = [];

      for (const candidate of [...manualSources, ...searchOutput.results]) {
        const parsed = searchResultSchema.parse(candidate);
        const canonicalUrl = canonicalizeUrl(parsed.url);
        const contentHash = createContentHash(parsed.body);

        if (canonicalUrls.has(canonicalUrl) || contentHashes.has(contentHash)) {
          continue;
        }

        canonicalUrls.add(canonicalUrl);
        contentHashes.add(contentHash);

        const existingSource = currentSources.find(
          (source) =>
            source.canonicalUrl === canonicalUrl || source.contentHash === contentHash,
        );
        const source: Source = existingSource ?? {
          id: createSourceId(run.projectId, contentHash),
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
        };
        selectedSources.push(source);

        if (!existingSource) {
          pendingSources.push(source);
        }

        if (selectedSources.length === run.sourceLimit) {
          break;
        }
      }

      const contentCharacters = selectedSources.reduce(
        (total, source) => total + source.body.length,
        0,
      );

      if (contentCharacters > run.maxContentChars) {
        throw new Error("CONTENT_LIMIT_EXCEEDED");
      }

      for (const source of pendingSources) {
        store.upsertSource(source);
      }

      return { sourceIds: selectedSources.map((source) => source.id) };
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
      assertProviderBudget();
      const result = await providers.embedding.embed({
        texts: missingEmbeddings.map((chunk) => chunk.text),
        idempotencyKey,
      });
      applyUsage(idempotencyKey, result.usage);
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
    extractedClaimsOutputSchema,
    async (idempotencyKey) => {
      const snapshot = store.getSnapshot();
      const chunks = snapshot.chunks.filter((chunk) => indexed.chunkIds.includes(chunk.id));
      assertProviderBudget();
      const result = await providers.languageModel.generateStructured({
        operation: "extract_claims",
        schema: claimCandidatesSchema,
        payload: { chunks },
        idempotencyKey,
      });
      applyUsage(idempotencyKey, result.usage);
      const output = claimCandidatesSchema.parse(result.data);
      const claimIdsByCandidate: Record<string, string> = {};

      for (const candidate of output.claims) {
        const claim = store.upsertClaim({
          id: createClaimId(run.projectId, candidate.candidateId),
          projectId: run.projectId,
          statement: candidate.statement,
          normalizedKey: createClaimKey(candidate.statement),
          claimType: candidate.claimType,
          qualifiers: candidate.qualifiers,
          confidence: candidate.confidence,
          reviewStatus: "pending",
          createdAt: now(),
        });
        claimIdsByCandidate[candidate.candidateId] = claim.id;
      }

      return { ...output, claimIdsByCandidate };
    },
  );

  const linkedEvidence = await executeStep(
    "linking_evidence",
    evidenceOutputSchema,
    async (idempotencyKey) => {
      assertProviderBudget();
      const result = await providers.languageModel.generateStructured({
        operation: "link_evidence",
        schema: evidenceCandidatesSchema,
        payload: { claims: extractedClaims.claims, chunkIds: indexed.chunkIds },
        idempotencyKey,
      });
      applyUsage(idempotencyKey, result.usage);
      const output = evidenceCandidatesSchema.parse(result.data);
      const snapshot = store.getSnapshot();
      const sourceByUrl = new Map(
        snapshot.sources
          .filter((source) => source.projectId === run.projectId)
          .map((source) => [source.canonicalUrl, source]),
      );
      const evidenceLinkIds = output.evidence.map((candidate) => {
        const source = sourceByUrl.get(canonicalizeUrl(candidate.sourceUrl));
        const chunk = snapshot.chunks.find(
          (current) =>
            indexed.chunkIds.includes(current.id) &&
            current.sourceId === source?.id &&
            current.projectId === run.projectId &&
            current.text.includes(candidate.quote),
        );

        if (!source || !chunk) {
          throw new Error("QUOTE_NOT_FOUND");
        }

        return store.upsertEvidenceLink({
          id: `link_${run.projectId}_${extractedClaims.claimIdsByCandidate[candidate.claimCandidateId]}_${chunk.id}_${candidate.relation}`,
          projectId: run.projectId,
          claimId: extractedClaims.claimIdsByCandidate[candidate.claimCandidateId],
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
      assertProviderBudget();
      const result = await providers.languageModel.generateStructured({
        operation: "detect_conflicts",
        schema: conflictCandidatesSchema,
        payload: { claims: extractedClaims.claims },
        idempotencyKey,
      });
      applyUsage(idempotencyKey, result.usage);
      const output = conflictCandidatesSchema.parse(result.data);
      const claimRelationIds = output.relations.map((candidate) =>
        store.upsertClaimRelation({
          id: `relation_${run.projectId}_${extractedClaims.claimIdsByCandidate[candidate.fromClaimCandidateId]}_${extractedClaims.claimIdsByCandidate[candidate.toClaimCandidateId]}_${candidate.relation}`,
          projectId: run.projectId,
          fromClaimId: extractedClaims.claimIdsByCandidate[candidate.fromClaimCandidateId],
          toClaimId: extractedClaims.claimIdsByCandidate[candidate.toClaimCandidateId],
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
      const snapshot = store.getSnapshot();
      const evidenceByClaim = new Map<string, EvidenceLink[]>();

      for (const link of snapshot.evidenceLinks) {
        if (link.projectId !== run.projectId) {
          continue;
        }

        const current = evidenceByClaim.get(link.claimId) ?? [];
        current.push(link);
        evidenceByClaim.set(link.claimId, current);
      }

      const supportedClaims = extractedClaims.claims.filter((claim) =>
        evidenceByClaim.has(extractedClaims.claimIdsByCandidate[claim.candidateId]),
      );
      const supportedClaimIds = new Set(supportedClaims.map((claim) => claim.candidateId));
      assertProviderBudget();
      const result = await providers.languageModel.generateStructured({
        operation: "draft_report",
        schema: reportDraftSchema,
        payload: { claims: supportedClaims, evidenceLinkIds: linkedEvidence.evidenceLinkIds },
        idempotencyKey,
      });
      applyUsage(idempotencyKey, result.usage);
      const output = reportDraftSchema.parse(result.data);

      for (const section of output.sections) {
        const hasSupportedClaim = section.claimIds.some((claimId) =>
          supportedClaimIds.has(claimId),
        );
        const hasUnsupportedClaim = section.claimIds.some(
          (claimId) => !supportedClaimIds.has(claimId),
        );

        if (hasSupportedClaim && hasUnsupportedClaim) {
          throw new Error("REPORT_CITATION_INVALID");
        }
      }

      const sections = output.sections
        .filter((section) => section.claimIds.some((claimId) => supportedClaimIds.has(claimId)))
        .map((section) => {
          const citationIds = Array.from(
            new Set(
              section.claimIds.flatMap((claimId) =>
                (
                  evidenceByClaim.get(extractedClaims.claimIdsByCandidate[claimId]) ?? []
                ).map((link) => link.id),
              ),
            ),
          );
          const citationMarkers = citationIds.map((citationId) => `[${citationId}]`).join(" ");
          const markdown = section.factual
            ? section.markdown
                .split(/\n\n+/)
                .map((paragraph) => `${paragraph} ${citationMarkers}`)
                .join("\n\n")
            : section.markdown;

          return {
            id: section.id,
            heading: section.heading,
            factual: section.factual,
            markdown,
            citationIds,
          };
        });
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

export const runResearchWorkflow = async (
  input: RunResearchWorkflowInput,
): Promise<ResearchWorkflowResult> => {
  try {
    return await runResearchWorkflowAttempt(input);
  } catch (error) {
    let run = input.store.requireRun({ runId: input.runId, ownerId: input.ownerId });

    if (run.status === "ready") {
      throw error;
    }

    const activeStep = WORKFLOW_STEPS.find((step) => step === run.step);
    const errorMessage = error instanceof Error ? error.message : "";
    const errorCode = KNOWN_WORKFLOW_ERRORS.has(errorMessage)
      ? errorMessage
      : "WORKFLOW_FAILED";

    if (activeStep) {
      const stepLogs = input.store
        .listRunLogs(input.runId)
        .filter((entry) => entry.step === activeStep);
      const startedAttempts = stepLogs.filter((entry) => entry.status === "started").length;
      const failedAttempts = stepLogs.filter((entry) => entry.status === "failed").length;
      const attempt = Math.max(startedAttempts, failedAttempts + 1, 1);
      input.store.appendRunLog({
        id: `${input.runId}:${activeStep}:${attempt}:2_failed`,
        runId: input.runId,
        step: activeStep,
        status: "failed",
        attempt: Math.max(attempt, 1),
        timestamp: input.now(),
        errorCode,
      });
    }

    run = input.store.updateRun({
      ...run,
      status: "failed",
      step: "failed",
      errorMessage: errorCode,
      updatedAt: input.now(),
    });

    return {
      run,
      report: undefined,
      evidenceLinks: input.store
        .getSnapshot()
        .evidenceLinks.filter((link) => link.projectId === run.projectId),
      completedSteps: WORKFLOW_STEPS.filter((step) =>
        input.store.getCheckpoint(input.runId, step),
      ),
    };
  }
};
