import { validateExactQuote } from "@/features/claims/claim-utils";
import {
  claimRelationSchema,
  claimSchema,
  evidenceLinkSchema,
  sourceChunkSchema,
  sourceSchema,
  type Claim,
  type ClaimRelation,
  type EvidenceLink,
  type Project,
  type ResearchRun,
  type Source,
  type SourceChunk,
} from "@/features/research/domain";
import type { DemoResearchFixture } from "@/features/research/fixtures";
import {
  embeddedChunkSchema,
  researchReportSchema,
  runLogEntrySchema,
  workflowCheckpointSchema,
  type EmbeddedChunk,
  type ResearchReport,
  type RunLogEntry,
  type WorkflowCheckpoint,
  type WorkflowStep,
} from "@/features/research/workflow-types";

export type InMemoryResearchWorkflowStore = {
  requireRun: (input: { runId: string; ownerId: string }) => ResearchRun;
  upsertSource: (source: Source) => Source;
  upsertChunk: (chunk: SourceChunk) => SourceChunk;
  upsertClaim: (claim: Claim) => Claim;
  upsertEvidenceLink: (link: EvidenceLink) => EvidenceLink;
  upsertClaimRelation: (relation: ClaimRelation) => ClaimRelation;
  getCheckpoint: (runId: string, step: WorkflowStep) => WorkflowCheckpoint | undefined;
  saveCheckpoint: (checkpoint: WorkflowCheckpoint) => WorkflowCheckpoint;
  getReport: (runId: string) => ResearchReport | undefined;
  saveReport: (report: ResearchReport) => ResearchReport;
  appendRunLog: (entry: RunLogEntry) => RunLogEntry;
  listRunLogs: (runId: string) => RunLogEntry[];
  getEmbedding: (chunkId: string) => EmbeddedChunk | undefined;
  saveEmbedding: (embedding: EmbeddedChunk) => EmbeddedChunk;
  getSnapshot: () => ResearchWorkflowSnapshot;
};

export type ResearchWorkflowSnapshot = {
  projects: Project[];
  runs: ResearchRun[];
  sources: Source[];
  chunks: SourceChunk[];
  claims: Claim[];
  evidenceLinks: EvidenceLink[];
  claimRelations: ClaimRelation[];
  checkpoints: WorkflowCheckpoint[];
  reports: ResearchReport[];
  runLogs: RunLogEntry[];
  embeddings: EmbeddedChunk[];
};

const cloneValue = <T>(value: T): T => structuredClone(value);

export const createInMemoryResearchWorkflowStore = (
  fixture: DemoResearchFixture,
): InMemoryResearchWorkflowStore => {
  const projects = new Map(
    fixture.projects.map((project) => [project.id, cloneValue(project)]),
  );
  const runs = new Map(fixture.researchRuns.map((run) => [run.id, cloneValue(run)]));
  const sources = new Map(fixture.sources.map((source) => [source.id, cloneValue(source)]));
  const chunks = new Map(fixture.chunks.map((chunk) => [chunk.id, cloneValue(chunk)]));
  const claims = new Map(fixture.claims.map((claim) => [claim.id, cloneValue(claim)]));
  const evidenceLinks = new Map(
    fixture.evidenceLinks.map((link) => [link.id, cloneValue(link)]),
  );
  const claimRelations = new Map<string, ClaimRelation>();
  const checkpoints = new Map<string, WorkflowCheckpoint>();
  const reports = new Map<string, ResearchReport>();
  const runLogs = new Map<string, RunLogEntry>();
  const embeddings = new Map<string, EmbeddedChunk>();
  const createCheckpointKey = (runId: string, step: WorkflowStep) => `${runId}:${step}`;

  return {
    requireRun: ({ runId, ownerId }) => {
      const run = runs.get(runId);

      if (!run || run.ownerId !== ownerId) {
        throw new Error("RUN_NOT_FOUND");
      }

      return cloneValue(run);
    },
    upsertSource: (input) => {
      const source = sourceSchema.parse(input);

      if (!projects.has(source.projectId)) {
        throw new Error("PROJECT_NOT_FOUND");
      }

      const current =
        sources.get(source.id) ??
        Array.from(sources.values()).find(
          (candidate) =>
            candidate.projectId === source.projectId &&
            (candidate.canonicalUrl === source.canonicalUrl ||
              candidate.contentHash === source.contentHash),
        );

      if (current) {
        return cloneValue(current);
      }

      sources.set(source.id, cloneValue(source));
      return cloneValue(source);
    },
    upsertChunk: (input) => {
      const chunk = sourceChunkSchema.parse(input);
      const source = sources.get(chunk.sourceId);

      if (!source || source.projectId !== chunk.projectId) {
        throw new Error("SOURCE_NOT_FOUND");
      }

      const current =
        chunks.get(chunk.id) ??
        Array.from(chunks.values()).find(
          (candidate) =>
            candidate.sourceId === chunk.sourceId && candidate.chunkIndex === chunk.chunkIndex,
        );

      if (current) {
        return cloneValue(current);
      }

      chunks.set(chunk.id, cloneValue(chunk));
      return cloneValue(chunk);
    },
    upsertClaim: (input) => {
      const claim = claimSchema.parse(input);

      if (!projects.has(claim.projectId)) {
        throw new Error("PROJECT_NOT_FOUND");
      }

      const current =
        claims.get(claim.id) ??
        Array.from(claims.values()).find(
          (candidate) =>
            candidate.projectId === claim.projectId &&
            candidate.normalizedKey === claim.normalizedKey,
        );

      if (current) {
        return cloneValue(current);
      }

      claims.set(claim.id, cloneValue(claim));
      return cloneValue(claim);
    },
    upsertEvidenceLink: (input) => {
      const link = evidenceLinkSchema.parse(input);
      const claim = claims.get(link.claimId);
      const chunk = chunks.get(link.chunkId);

      if (!claim || !chunk || claim.projectId !== link.projectId || chunk.projectId !== link.projectId) {
        throw new Error("EVIDENCE_TARGET_NOT_FOUND");
      }

      const quoteValidation = validateExactQuote({ chunkText: chunk.text, quote: link.quote });

      if (!quoteValidation.ok) {
        throw new Error(quoteValidation.reason);
      }

      const current =
        evidenceLinks.get(link.id) ??
        Array.from(evidenceLinks.values()).find(
          (candidate) =>
            candidate.claimId === link.claimId &&
            candidate.chunkId === link.chunkId &&
            candidate.relation === link.relation,
        );

      if (current) {
        return cloneValue(current);
      }

      evidenceLinks.set(link.id, cloneValue(link));
      return cloneValue(link);
    },
    upsertClaimRelation: (input) => {
      const relation = claimRelationSchema.parse(input);
      const fromClaim = claims.get(relation.fromClaimId);
      const toClaim = claims.get(relation.toClaimId);

      if (
        !fromClaim ||
        !toClaim ||
        fromClaim.projectId !== relation.projectId ||
        toClaim.projectId !== relation.projectId
      ) {
        throw new Error("CLAIM_NOT_FOUND");
      }

      const current =
        claimRelations.get(relation.id) ??
        Array.from(claimRelations.values()).find(
          (candidate) =>
            candidate.fromClaimId === relation.fromClaimId &&
            candidate.toClaimId === relation.toClaimId &&
            candidate.relation === relation.relation,
        );

      if (current) {
        return cloneValue(current);
      }

      claimRelations.set(relation.id, cloneValue(relation));
      return cloneValue(relation);
    },
    getCheckpoint: (runId, step) => {
      const checkpoint = checkpoints.get(createCheckpointKey(runId, step));
      return checkpoint ? cloneValue(checkpoint) : undefined;
    },
    saveCheckpoint: (input) => {
      const checkpoint = workflowCheckpointSchema.parse(input);

      if (!runs.has(checkpoint.runId)) {
        throw new Error("RUN_NOT_FOUND");
      }

      const key = createCheckpointKey(checkpoint.runId, checkpoint.step);
      const current = checkpoints.get(key);

      if (current) {
        if (current.idempotencyKey !== checkpoint.idempotencyKey) {
          throw new Error("STEP_ALREADY_COMPLETED");
        }

        return cloneValue(current);
      }

      checkpoints.set(key, cloneValue(checkpoint));
      return cloneValue(checkpoint);
    },
    getReport: (runId) => {
      const report = reports.get(runId);
      return report ? cloneValue(report) : undefined;
    },
    saveReport: (input) => {
      const report = researchReportSchema.parse(input);
      const run = runs.get(report.runId);

      if (!run || run.projectId !== report.projectId) {
        throw new Error("RUN_NOT_FOUND");
      }

      const citations = new Map(
        report.citations.map((citation) => [citation.evidenceLinkId, citation]),
      );

      for (const section of report.sections) {
        if (section.factual && section.citationIds.length === 0) {
          throw new Error("REPORT_CITATION_REQUIRED");
        }

        for (const citationId of section.citationIds) {
          if (!citations.has(citationId)) {
            throw new Error("REPORT_CITATION_NOT_FOUND");
          }
        }
      }

      for (const citation of report.citations) {
        const link = evidenceLinks.get(citation.evidenceLinkId);
        const chunk = chunks.get(citation.chunkId);
        const source = sources.get(citation.sourceId);

        if (!link) {
          throw new Error("EVIDENCE_LINK_NOT_FOUND");
        }

        if (
          !chunk ||
          !source ||
          link.claimId !== citation.claimId ||
          link.chunkId !== citation.chunkId ||
          link.quote !== citation.quote ||
          chunk.sourceId !== citation.sourceId ||
          source.canonicalUrl !== citation.sourceUrl ||
          source.title !== citation.sourceTitle
        ) {
          throw new Error("REPORT_CITATION_INVALID");
        }
      }

      const current = reports.get(report.runId);

      if (current) {
        if (current.id !== report.id) {
          throw new Error("REPORT_ALREADY_EXISTS");
        }

        return cloneValue(current);
      }

      reports.set(report.runId, cloneValue(report));
      return cloneValue(report);
    },
    appendRunLog: (input) => {
      const entry = runLogEntrySchema.parse(input);

      if (!runs.has(entry.runId)) {
        throw new Error("RUN_NOT_FOUND");
      }

      const current = runLogs.get(entry.id);

      if (current) {
        return cloneValue(current);
      }

      runLogs.set(entry.id, cloneValue(entry));
      return cloneValue(entry);
    },
    listRunLogs: (runId) =>
      Array.from(runLogs.values())
        .filter((entry) => entry.runId === runId)
        .sort(
          (left, right) =>
            left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id),
        )
        .map(cloneValue),
    getEmbedding: (chunkId) => {
      const embedding = embeddings.get(chunkId);
      return embedding ? cloneValue(embedding) : undefined;
    },
    saveEmbedding: (input) => {
      const embedding = embeddedChunkSchema.parse(input);

      if (!chunks.has(embedding.chunkId)) {
        throw new Error("CHUNK_NOT_FOUND");
      }

      const current = embeddings.get(embedding.chunkId);

      if (current) {
        return cloneValue(current);
      }

      embeddings.set(embedding.chunkId, cloneValue(embedding));
      return cloneValue(embedding);
    },
    getSnapshot: () =>
      cloneValue({
        projects: Array.from(projects.values()),
        runs: Array.from(runs.values()),
        sources: Array.from(sources.values()),
        chunks: Array.from(chunks.values()),
        claims: Array.from(claims.values()),
        evidenceLinks: Array.from(evidenceLinks.values()),
        claimRelations: Array.from(claimRelations.values()),
        checkpoints: Array.from(checkpoints.values()),
        reports: Array.from(reports.values()),
        runLogs: Array.from(runLogs.values()),
        embeddings: Array.from(embeddings.values()),
      }),
  };
};
