import { z } from "zod";

import { createClaimKey } from "@/features/claims/claim-utils";
import {
  currentEmbeddingModel,
  type EvidenceLink,
  type ResearchRun,
  type Source,
} from "@/features/research/domain";
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
  type ProviderResult,
  type ProviderUsage,
  type SearchProvider,
  type SearchResult,
} from "@/providers/contracts";

type ResearchWorkflowProviders = {
  search: SearchProvider;
  languageModel: LanguageModel;
  embedding: EmbeddingProvider;
};

export type ProviderCallExecutor = <T>(
  idempotencyKey: string,
  operation: () => Promise<ProviderResult<T>>,
) => Promise<ProviderResult<T>>;

type RunResearchWorkflowInput = {
  runId: string;
  ownerId: string;
  manualSources: SearchResult[];
  manualUrls?: string[];
  providers: ResearchWorkflowProviders;
  executeProviderCall?: ProviderCallExecutor;
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
const MAX_INDEXED_CHUNKS = 1500;
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
  "BAILIAN_REQUEST_FAILED",
  "CLAIM_CANDIDATE_NOT_FOUND",
  "CONTENT_LIMIT_EXCEEDED",
  "DEEPSEEK_REQUEST_FAILED",
  "MANUAL_URL_LIMIT_EXCEEDED",
  "PROJECT_NOT_FOUND",
  "PROVIDER_REQUEST_TIMEOUT",
  "PROVIDER_RESPONSE_INVALID",
  "QUOTE_NOT_FOUND",
  "REPORT_CITATION_INVALID",
  "REPORT_NOT_FOUND",
  "RUN_COST_LIMIT_EXCEEDED",
  "RUN_NOT_FOUND",
  "SOURCE_NOT_FOUND",
  "STEP_RETRY_LIMIT_EXCEEDED",
  "TAVILY_REQUEST_FAILED",
]);

const createSourceId = (projectId: string, contentHash: string) =>
  `source_${projectId}_${contentHash.replace("sha256_", "").slice(0, 20)}`;
const createClaimId = (projectId: string, candidateId: string) =>
  `claim_${projectId}_${candidateId}`;
const countUnicodeCodePoints = (content: string) => Array.from(content).length;

const roundCost = (cost: number) => Math.round(cost * 1_000_000) / 1_000_000;

const executeProviderCallDirectly: ProviderCallExecutor = async (
  _idempotencyKey,
  operation,
) => operation();

const getRunEvidenceLinks = ({
  store,
  projectId,
  evidenceLinkIds,
}: {
  store: InMemoryResearchWorkflowStore;
  projectId: string;
  evidenceLinkIds: string[];
}) => {
  const evidenceLinkIdSet = new Set(evidenceLinkIds);

  return store
    .getSnapshot()
    .evidenceLinks.filter(
      (link) => link.projectId === projectId && evidenceLinkIdSet.has(link.id),
    );
};

const runResearchWorkflowAttempt = async ({
  runId,
  ownerId,
  manualSources,
  manualUrls = [],
  providers,
  executeProviderCall = executeProviderCallDirectly,
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

  const researchContext = {
    question: project.question,
    language: project.language,
  };

  if (run.status === "ready") {
    const report = store.getReport(runId);
    const linkingCheckpoint = store.getCheckpoint(runId, "linking_evidence");

    if (!report || !linkingCheckpoint) {
      throw new Error("REPORT_NOT_FOUND");
    }

    const linkedEvidence = evidenceOutputSchema.parse(linkingCheckpoint.output);

    return {
      run,
      report,
      evidenceLinks: getRunEvidenceLinks({
        store,
        projectId: run.projectId,
        evidenceLinkIds: linkedEvidence.evidenceLinkIds,
      }),
      completedSteps: WORKFLOW_STEPS.filter((step) => store.getCheckpoint(runId, step)),
    };
  }

  if (manualSources.length + manualUrls.length > run.manualUrlLimit) {
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
    const result = await executeProviderCall(idempotencyKey, () =>
      providers.languageModel.generateStructured({
        operation: "plan",
        schema: searchPlanSchema,
        payload: researchContext,
        idempotencyKey,
      }),
    );
    applyUsage(idempotencyKey, result.usage);
    return searchPlanSchema.parse(result.data);
  });

  const searchOutput = await executeStep(
    "searching",
    searchOutputSchema,
    async (idempotencyKey) => {
      const results: SearchResult[] = [];

      for (const [queryIndex, query] of plan.queries.entries()) {
        const queryIdempotencyKey = `${idempotencyKey}:${queryIndex}`;
        const savedResults = store.getSearchResults(queryIdempotencyKey);

        if (savedResults) {
          results.push(...savedResults);
          continue;
        }

        assertProviderBudget();
        const result = await executeProviderCall(queryIdempotencyKey, () =>
          providers.search.search({
            query,
            maxResults: run.sourceLimit,
            idempotencyKey: queryIdempotencyKey,
          }),
        );
        applyUsage(queryIdempotencyKey, result.usage);
        const parsedResults = searchResultSchema.array().parse(result.data);
        store.saveSearchResults(queryIdempotencyKey, parsedResults);
        results.push(...parsedResults);
      }

      return { results };
    },
  );

  const collected = await executeStep(
    "collecting",
    sourceOutputSchema,
    async () => {
      const manualExtractionKey = `${runId}:collecting:manual`;
      let extractedManualSources = store.getSearchResults(manualExtractionKey);

      if (!extractedManualSources && manualUrls.length > 0) {
        assertProviderBudget();
        const result = await executeProviderCall(manualExtractionKey, () =>
          providers.search.extract({
            urls: manualUrls,
            idempotencyKey: manualExtractionKey,
          }),
        );
        applyUsage(manualExtractionKey, result.usage);
        extractedManualSources = searchResultSchema.array().parse(result.data);
        store.saveSearchResults(manualExtractionKey, extractedManualSources);
      }

      const canonicalUrls = new Set<string>();
      const contentHashes = new Set<string>();
      const currentSources = store
        .getSnapshot()
        .sources.filter((source) => source.projectId === run.projectId);
      const selectedSources: Source[] = [];
      const selectedSourceIds = new Set<string>();
      const pendingSources: Source[] = [];
      let contentCodePoints = 0;
      let exceededContentBudget = false;

      for (const candidate of [
        ...manualSources,
        ...(extractedManualSources ?? []),
        ...searchOutput.results,
      ]) {
        const parsed = searchResultSchema.parse(candidate);
        const canonicalUrl = canonicalizeUrl(parsed.url);
        const contentHash = createContentHash(parsed.body);

        if (canonicalUrls.has(canonicalUrl) || contentHashes.has(contentHash)) {
          continue;
        }

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

        if (selectedSourceIds.has(source.id)) {
          continue;
        }

        const sourceCodePoints = countUnicodeCodePoints(source.body);

        if (contentCodePoints + sourceCodePoints > run.maxContentChars) {
          exceededContentBudget = true;
          continue;
        }

        selectedSources.push(source);
        selectedSourceIds.add(source.id);
        canonicalUrls.add(canonicalUrl);
        contentHashes.add(contentHash);
        contentCodePoints += sourceCodePoints;

        if (!existingSource) {
          pendingSources.push(source);
        }

        if (selectedSources.length === run.sourceLimit) {
          break;
        }
      }

      if (selectedSources.length === 0 && exceededContentBudget) {
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

    if (chunks.length > MAX_INDEXED_CHUNKS) {
      throw new Error("CONTENT_LIMIT_EXCEEDED");
    }

    for (let batchStart = 0; batchStart < chunks.length; batchStart += 10) {
      const batchIndex = Math.floor(batchStart / 10);
      const batchIdempotencyKey = `${idempotencyKey}:${batchIndex}`;
      const batch = chunks.slice(batchStart, batchStart + 10);
      const missingEmbeddings = batch.filter((chunk) => !store.getEmbedding(chunk.id));

      if (missingEmbeddings.length === 0) {
        continue;
      }

      assertProviderBudget();
      const result = await executeProviderCall(batchIdempotencyKey, async () => {
        const providerResult = await providers.embedding.embed({
          texts: missingEmbeddings.map((chunk) => chunk.text),
          idempotencyKey: batchIdempotencyKey,
        });
        const vectors = z
          .array(z.array(z.number()).length(1536))
          .length(missingEmbeddings.length)
          .parse(providerResult.data);

        return { ...providerResult, data: vectors };
      });
      applyUsage(batchIdempotencyKey, result.usage);

      for (const [index, chunk] of missingEmbeddings.entries()) {
        store.saveEmbedding({
          chunkId: chunk.id,
          model: currentEmbeddingModel,
          dimensions: 1536,
          vector: result.data[index],
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
      const result = await executeProviderCall(idempotencyKey, () =>
        providers.languageModel.generateStructured({
          operation: "extract_claims",
          schema: claimCandidatesSchema,
          payload: { ...researchContext, chunks },
          idempotencyKey,
        }),
      );
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
      const snapshot = store.getSnapshot();
      const sourceById = new Map(
        snapshot.sources
          .filter((source) => source.projectId === run.projectId)
          .map((source) => [source.id, source]),
      );
      const chunkById = new Map(snapshot.chunks.map((chunk) => [chunk.id, chunk]));
      const sourceChunks = indexed.chunkIds.map((chunkId) => {
        const chunk = chunkById.get(chunkId);
        const source = chunk ? sourceById.get(chunk.sourceId) : undefined;

        if (!chunk || chunk.projectId !== run.projectId || !source) {
          throw new Error("SOURCE_NOT_FOUND");
        }

        return {
          chunkId: chunk.id,
          text: chunk.text,
          sourceId: source.id,
          sourceUrl: source.canonicalUrl,
          sourceTitle: source.title,
        };
      });
      const claimCandidateIds = new Set(
        extractedClaims.claims.map((claim) => claim.candidateId),
      );
      assertProviderBudget();
      const result = await executeProviderCall(idempotencyKey, async () => {
        const providerResult = await providers.languageModel.generateStructured({
          operation: "link_evidence",
          schema: evidenceCandidatesSchema,
          payload: {
            ...researchContext,
            claims: extractedClaims.claims,
            sourceChunks,
          },
          idempotencyKey,
        });
        const output = evidenceCandidatesSchema.parse(providerResult.data);

        for (const candidate of output.evidence) {
          if (!claimCandidateIds.has(candidate.claimCandidateId)) {
            throw new Error("CLAIM_CANDIDATE_NOT_FOUND");
          }

          const sourceUrl = canonicalizeUrl(candidate.sourceUrl);
          const hasExactSourceQuote = sourceChunks.some(
            (chunk) =>
              chunk.sourceUrl === sourceUrl && chunk.text.includes(candidate.quote),
          );

          if (!hasExactSourceQuote) {
            throw new Error("QUOTE_NOT_FOUND");
          }
        }

        return { ...providerResult, data: output };
      });
      applyUsage(idempotencyKey, result.usage);
      const sourceByUrl = new Map(
        snapshot.sources
          .filter((source) => source.projectId === run.projectId)
          .map((source) => [source.canonicalUrl, source]),
      );
      const evidenceLinkIds = result.data.evidence.map((candidate) => {
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
      const claimCandidateIds = new Set(
        extractedClaims.claims.map((claim) => claim.candidateId),
      );
      assertProviderBudget();
      const result = await executeProviderCall(idempotencyKey, async () => {
        const providerResult = await providers.languageModel.generateStructured({
          operation: "detect_conflicts",
          schema: conflictCandidatesSchema,
          payload: { ...researchContext, claims: extractedClaims.claims },
          idempotencyKey,
        });
        const output = conflictCandidatesSchema.parse(providerResult.data);

        for (const candidate of output.relations) {
          if (
            !claimCandidateIds.has(candidate.fromClaimCandidateId) ||
            !claimCandidateIds.has(candidate.toClaimCandidateId)
          ) {
            throw new Error("CLAIM_CANDIDATE_NOT_FOUND");
          }
        }

        return { ...providerResult, data: output };
      });
      applyUsage(idempotencyKey, result.usage);
      const claimRelationIds = result.data.relations.map((candidate) =>
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
      const linkedEvidenceIdSet = new Set(linkedEvidence.evidenceLinkIds);
      const chunkById = new Map(snapshot.chunks.map((chunk) => [chunk.id, chunk]));
      const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));

      for (const link of snapshot.evidenceLinks) {
        if (link.projectId !== run.projectId || !linkedEvidenceIdSet.has(link.id)) {
          continue;
        }

        const current = evidenceByClaim.get(link.claimId) ?? [];
        current.push(link);
        evidenceByClaim.set(link.claimId, current);
      }

      const evidencedClaims = extractedClaims.claims.flatMap((claim) => {
        const evidenceLinks =
          evidenceByClaim.get(extractedClaims.claimIdsByCandidate[claim.candidateId]) ?? [];

        if (evidenceLinks.length === 0) {
          return [];
        }

        const evidence = evidenceLinks.map((link) => {
          const chunk = chunkById.get(link.chunkId);
          const source = chunk ? sourceById.get(chunk.sourceId) : undefined;

          if (!chunk || !source || source.projectId !== run.projectId) {
            throw new Error("REPORT_CITATION_INVALID");
          }

          return {
            relation: link.relation,
            strength: link.strength,
            quote: link.quote,
            rationale: link.rationale,
            sourceUrl: source.canonicalUrl,
            sourceTitle: source.title,
            chunkId: chunk.id,
          };
        });

        return [
          {
            ...claim,
            hasSupportingEvidence: evidence.some((item) => item.relation === "supports"),
            evidence,
          },
        ];
      });
      const evidencedClaimIds = new Set(
        evidencedClaims.map((claim) => claim.candidateId),
      );
      assertProviderBudget();
      const result = await executeProviderCall(idempotencyKey, async () => {
        const providerResult = await providers.languageModel.generateStructured({
          operation: "draft_report",
          schema: reportDraftSchema,
          payload: {
            ...researchContext,
            claims: evidencedClaims,
          },
          idempotencyKey,
        });
        const output = reportDraftSchema.parse(providerResult.data);

        if (output.sections.length === 0) {
          throw new Error("REPORT_CITATION_INVALID");
        }

        for (const section of output.sections) {
          for (const paragraph of section.paragraphs) {
            if (paragraph.claimIds.some((claimId) => !evidencedClaimIds.has(claimId))) {
              throw new Error("REPORT_CITATION_INVALID");
            }
          }
        }

        return { ...providerResult, data: output };
      });
      applyUsage(idempotencyKey, result.usage);
      const sections = result.data.sections.flatMap((section) => {
        const paragraphs = section.paragraphs.flatMap((paragraph) => {
          const hasEvidencedClaim = paragraph.claimIds.some((claimId) =>
            evidencedClaimIds.has(claimId),
          );
          const hasUnsupportedClaim = paragraph.claimIds.some(
            (claimId) => !evidencedClaimIds.has(claimId),
          );

          if (hasEvidencedClaim && hasUnsupportedClaim) {
            throw new Error("REPORT_CITATION_INVALID");
          }

          if (!hasEvidencedClaim) {
            return [];
          }

          const citationIds = Array.from(
            new Set(
              paragraph.claimIds.flatMap((claimId) =>
                (
                  evidenceByClaim.get(extractedClaims.claimIdsByCandidate[claimId]) ?? []
                ).map((link) => link.id),
              ),
            ),
          );
          const citationMarkers = citationIds.map((citationId) => `[${citationId}]`).join(" ");

          return [
            {
              markdown: section.factual
                ? `${paragraph.markdown} ${citationMarkers}`
                : paragraph.markdown,
              citationIds,
            },
          ];
        });

        if (paragraphs.length === 0) {
          return [];
        }

        return [
          {
            id: section.id,
            heading: section.heading,
            factual: section.factual,
            markdown: paragraphs.map((paragraph) => paragraph.markdown).join("\n\n"),
            citationIds: Array.from(
              new Set(paragraphs.flatMap((paragraph) => paragraph.citationIds)),
            ),
          },
        ];
      });
      const citationLinkIds = new Set(sections.flatMap((section) => section.citationIds));
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
    evidenceLinks: getRunEvidenceLinks({
      store,
      projectId: run.projectId,
      evidenceLinkIds: linkedEvidence.evidenceLinkIds,
    }),
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
