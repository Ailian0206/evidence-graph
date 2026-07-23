import type { SupabaseClient } from "@supabase/supabase-js";

import {
  claimRelationSchema,
  claimSchema,
  evidenceLinkSchema,
  projectSchema,
  researchRunSchema,
  sourceChunkSchema,
  sourceSchema,
  type Claim,
  type ClaimRelation,
  type EvidenceLink,
  type Source,
  type SourceChunk,
} from "@/features/research/domain";
import type { ResearchWorkflowSnapshot } from "@/features/research/workflow-store";
import {
  embeddedChunkSchema,
  researchReportSchema,
  runLogEntrySchema,
  workflowCheckpointSchema,
  type EmbeddedChunk,
  type ResearchReport,
  type RunLogEntry,
  type WorkflowCheckpoint,
} from "@/features/research/workflow-types";
import type { ResearchRequestedEventData } from "@/inngest/events";
import { researchRequestedEventSchema } from "@/inngest/events";
import { providerUsageSchema } from "@/providers/contracts";

export type WorkflowPersistenceQueries = {
  beginRun: (event: ResearchRequestedEventData) => Promise<void>;
  upsertSources: (sources: Source[]) => Promise<void>;
  upsertChunks: (input: {
    chunks: SourceChunk[];
    embeddings: EmbeddedChunk[];
  }) => Promise<void>;
  upsertClaims: (claims: Claim[]) => Promise<void>;
  upsertEvidenceLinks: (links: EvidenceLink[]) => Promise<void>;
  upsertClaimRelations: (relations: ClaimRelation[]) => Promise<void>;
  upsertCheckpoints: (input: {
    projectId: string;
    checkpoints: WorkflowCheckpoint[];
  }) => Promise<void>;
  upsertRunLogs: (input: { projectId: string; entries: RunLogEntry[] }) => Promise<void>;
  upsertReport: (report: ResearchReport | null) => Promise<void>;
  finalizeRun: (
    input: ResearchRequestedEventData & {
      searchCount: number;
      tokenCount: number;
      estimatedCostUsd: number;
    },
  ) => Promise<void>;
  failRun: (
    input: ResearchRequestedEventData & { errorCode: string },
  ) => Promise<void>;
};

export type DurableWorkflowWriter = {
  begin: (event: ResearchRequestedEventData) => Promise<void>;
  persist: (input: {
    event: ResearchRequestedEventData;
    snapshot: ResearchWorkflowSnapshot;
  }) => Promise<void>;
  fail: (
    input: ResearchRequestedEventData & { errorCode: string },
  ) => Promise<void>;
};

const throwQueryError = (error: { message: string } | null) => {
  if (error) {
    throw error;
  }
};

const upsertRows = async (
  client: SupabaseClient,
  table: string,
  rows: unknown[],
  onConflict: string,
) => {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).upsert(rows, { onConflict });
  throwQueryError(error);
};

const serializeVector = (vector: number[]) => `[${vector.join(",")}]`;

const assertEmbeddingMetadataMatchesChunks = ({
  chunks,
  embeddings,
}: {
  chunks: SourceChunk[];
  embeddings: EmbeddedChunk[];
}) => {
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));

  for (const embedding of embeddings) {
    const chunk = chunkById.get(embedding.chunkId);

    if (
      chunk &&
      (chunk.embeddingModel !== embedding.model ||
        chunk.embeddingDimensions !== embedding.dimensions)
    ) {
      throw new Error("WORKFLOW_EMBEDDING_MODEL_MISMATCH");
    }
  }
};

export const createSupabaseWorkflowPersistenceQueries = (
  client: SupabaseClient,
): WorkflowPersistenceQueries => ({
  beginRun: async ({ ownerId, projectId, runId }) => {
    const { error } = await client.rpc("begin_research_run", {
      requested_owner_id: ownerId,
      requested_project_id: projectId,
      requested_run_id: runId,
    });
    throwQueryError(error);
  },
  upsertSources: (sources) =>
    upsertRows(
      client,
      "sources",
      sources.map((source) => ({
        id: source.id,
        project_id: source.projectId,
        canonical_url: source.canonicalUrl,
        title: source.title,
        author: source.author ?? null,
        published_at: source.publishedAt ?? null,
        domain: source.domain,
        source_type: source.sourceType,
        body: source.body,
        content_hash: source.contentHash,
        retrieved_at: source.retrievedAt,
      })),
      "id",
    ),
  upsertChunks: ({ chunks, embeddings }) => {
    assertEmbeddingMetadataMatchesChunks({ chunks, embeddings });
    const embeddingByChunk = new Map(
      embeddings.map((embedding) => [embedding.chunkId, embedding]),
    );
    return upsertRows(
      client,
      "source_chunks",
      chunks.map((chunk) => ({
        id: chunk.id,
        source_id: chunk.sourceId,
        project_id: chunk.projectId,
        chunk_index: chunk.chunkIndex,
        body: chunk.text,
        start_char: chunk.startChar,
        end_char: chunk.endChar,
        embedding_model: chunk.embeddingModel,
        embedding_dimensions: chunk.embeddingDimensions,
        embedding: embeddingByChunk.has(chunk.id)
          ? serializeVector(embeddingByChunk.get(chunk.id)!.vector)
          : null,
      })),
      "id",
    );
  },
  upsertClaims: (claims) =>
    upsertRows(
      client,
      "claims",
      claims.map((claim) => ({
        id: claim.id,
        project_id: claim.projectId,
        statement: claim.statement,
        normalized_key: claim.normalizedKey,
        claim_type: claim.claimType,
        qualifiers: claim.qualifiers,
        confidence: claim.confidence,
        review_status: claim.reviewStatus,
        created_at: claim.createdAt,
      })),
      "id",
    ),
  upsertEvidenceLinks: (links) =>
    upsertRows(
      client,
      "evidence_links",
      links.map((link) => ({
        id: link.id,
        claim_id: link.claimId,
        chunk_id: link.chunkId,
        project_id: link.projectId,
        relation: link.relation,
        strength: link.strength,
        quote: link.quote,
        rationale: link.rationale,
      })),
      "id",
    ),
  upsertClaimRelations: (relations) =>
    upsertRows(
      client,
      "claim_relations",
      relations.map((relation) => ({
        id: relation.id,
        project_id: relation.projectId,
        from_claim_id: relation.fromClaimId,
        to_claim_id: relation.toClaimId,
        relation: relation.relation,
        rationale: relation.rationale,
      })),
      "id",
    ),
  upsertCheckpoints: ({ projectId, checkpoints }) =>
    upsertRows(
      client,
      "workflow_checkpoints",
      checkpoints.map((checkpoint) => ({
        run_id: checkpoint.runId,
        project_id: projectId,
        step: checkpoint.step,
        idempotency_key: checkpoint.idempotencyKey,
        output: checkpoint.output,
        completed_at: checkpoint.completedAt,
      })),
      "run_id,step",
    ),
  upsertRunLogs: ({ projectId, entries }) =>
    upsertRows(
      client,
      "run_logs",
      entries.map((entry) => ({
        id: entry.id,
        run_id: entry.runId,
        project_id: projectId,
        step: entry.step,
        status: entry.status,
        attempt: entry.attempt,
        occurred_at: entry.timestamp,
        error_code: entry.errorCode ?? null,
      })),
      "id",
    ),
  upsertReport: (report) =>
    report
      ? upsertRows(
          client,
          "reports",
          [
            {
              id: report.id,
              run_id: report.runId,
              project_id: report.projectId,
              slug: null,
              markdown: report.markdown,
              sections: report.sections,
              citations: report.citations,
              version: report.version,
              status: "draft",
              published_at: null,
              created_at: report.createdAt,
            },
          ],
          "id",
        )
      : Promise.resolve(),
  finalizeRun: async ({
    ownerId,
    projectId,
    runId,
    searchCount,
    tokenCount,
    estimatedCostUsd,
  }) => {
    const { error } = await client.rpc("finalize_research_run", {
      requested_owner_id: ownerId,
      requested_project_id: projectId,
      requested_run_id: runId,
      requested_search_count: searchCount,
      requested_token_count: tokenCount,
      requested_estimated_cost_usd: estimatedCostUsd,
    });
    throwQueryError(error);
  },
  failRun: async ({ ownerId, projectId, runId, errorCode }) => {
    const { error } = await client.rpc("fail_research_run", {
      requested_owner_id: ownerId,
      requested_project_id: projectId,
      requested_run_id: runId,
      requested_error_code: errorCode,
    });
    throwQueryError(error);
  },
});

const parseOwnedSnapshot = (
  event: ResearchRequestedEventData,
  snapshot: ResearchWorkflowSnapshot,
) => {
  const projects = projectSchema.array().parse(snapshot.projects);
  const runs = researchRunSchema.array().parse(snapshot.runs);
  const sources = sourceSchema.array().parse(snapshot.sources);
  const chunks = sourceChunkSchema.array().parse(snapshot.chunks);
  const claims = claimSchema.array().parse(snapshot.claims);
  const evidenceLinks = evidenceLinkSchema.array().parse(snapshot.evidenceLinks);
  const claimRelations = claimRelationSchema.array().parse(snapshot.claimRelations);
  const checkpoints = workflowCheckpointSchema.array().parse(snapshot.checkpoints);
  const reports = researchReportSchema.array().parse(snapshot.reports);
  const runLogs = runLogEntrySchema.array().parse(snapshot.runLogs);
  const embeddings = embeddedChunkSchema.array().parse(snapshot.embeddings);
  snapshot.providerUsages.forEach(({ usage }) => providerUsageSchema.parse(usage));
  assertEmbeddingMetadataMatchesChunks({ chunks, embeddings });

  const project = projects.find((candidate) => candidate.id === event.projectId);
  const run = runs.find((candidate) => candidate.id === event.runId);
  const chunkIds = new Set(chunks.map((chunk) => chunk.id));
  const isOwnedProject = project?.ownerId === event.ownerId;
  const isOwnedRun =
    run?.ownerId === event.ownerId &&
    run.projectId === event.projectId &&
    run.status === "ready";
  const allRowsMatch =
    projects.every(
      (candidate) =>
        candidate.id === event.projectId && candidate.ownerId === event.ownerId,
    ) &&
    runs.every(
      (candidate) =>
        candidate.id === event.runId &&
        candidate.projectId === event.projectId &&
        candidate.ownerId === event.ownerId,
    ) &&
    sources.every((source) => source.projectId === event.projectId) &&
    chunks.every((chunk) => chunk.projectId === event.projectId) &&
    claims.every((claim) => claim.projectId === event.projectId) &&
    evidenceLinks.every((link) => link.projectId === event.projectId) &&
    claimRelations.every((relation) => relation.projectId === event.projectId) &&
    checkpoints.every((checkpoint) => checkpoint.runId === event.runId) &&
    runLogs.every((entry) => entry.runId === event.runId) &&
    reports.every(
      (report) =>
        report.runId === event.runId && report.projectId === event.projectId,
    ) &&
    embeddings.every((embedding) => chunkIds.has(embedding.chunkId));

  if (!isOwnedProject || !isOwnedRun || !allRowsMatch) {
    throw new Error("WORKFLOW_PROJECT_MISMATCH");
  }

  const report = reports.find((candidate) => candidate.runId === event.runId);
  if (!report) {
    throw new Error("WORKFLOW_REPORT_NOT_FOUND");
  }

  return {
    run,
    sources,
    chunks,
    claims,
    evidenceLinks,
    claimRelations,
    checkpoints,
    report,
    runLogs,
    embeddings,
  };
};

export const createDurableWorkflowWriter = (
  queries: WorkflowPersistenceQueries,
): DurableWorkflowWriter => ({
  begin: (event) => queries.beginRun(researchRequestedEventSchema.parse(event)),
  persist: async ({ event: inputEvent, snapshot }) => {
    const event = researchRequestedEventSchema.parse(inputEvent);
    const parsed = parseOwnedSnapshot(event, snapshot);

    await queries.upsertSources(parsed.sources);
    await queries.upsertChunks({ chunks: parsed.chunks, embeddings: parsed.embeddings });
    await queries.upsertClaims(parsed.claims);
    await queries.upsertEvidenceLinks(parsed.evidenceLinks);
    await queries.upsertClaimRelations(parsed.claimRelations);
    await queries.upsertCheckpoints({
      projectId: event.projectId,
      checkpoints: parsed.checkpoints,
    });
    await queries.upsertRunLogs({ projectId: event.projectId, entries: parsed.runLogs });
    await queries.upsertReport(parsed.report);
    await queries.finalizeRun({
      ...event,
      searchCount: parsed.run.searchCount,
      tokenCount: parsed.run.tokenCount,
      estimatedCostUsd: parsed.run.estimatedCostUsd,
    });
  },
  fail: ({ errorCode, ...event }) =>
    queries.failRun({
      ...researchRequestedEventSchema.parse(event),
      errorCode,
    }),
});
