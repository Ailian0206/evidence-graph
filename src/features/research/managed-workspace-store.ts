import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapReportRow,
  reportColumns,
  type ReportRow,
} from "@/features/reports/report-store";
import {
  claimRelationSchema,
  claimSchema,
  evidenceLinkSchema,
  projectSchema,
  researchRunSchema,
  sourceChunkSchema,
  sourceSchema,
} from "@/features/research/domain";
import type { EvidenceWorkspaceData } from "@/features/research/evidence-workspace";
import { runLogEntrySchema } from "@/features/research/workflow-types";
import type { AppLocale } from "@/i18n/routing";

type ProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  question: string;
  status: "active" | "archived" | "deleted";
  visibility: "private" | "public";
  slug: string;
  created_at: string;
  updated_at: string;
};

type ResearchRunRow = {
  id: string;
  project_id: string;
  owner_id: string;
  status: "queued" | "running" | "ready" | "failed" | "cancelled";
  step:
    | "queued"
    | "planning"
    | "searching"
    | "collecting"
    | "indexing"
    | "extracting_claims"
    | "linking_evidence"
    | "detecting_conflicts"
    | "drafting_report"
    | "ready"
    | "failed"
    | "cancelled";
  source_limit: number;
  manual_url_limit: number;
  max_content_chars: number;
  estimated_cost_usd: number;
  search_count: number;
  token_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type SourceRow = {
  id: string;
  project_id: string;
  canonical_url: string;
  title: string;
  author: string | null;
  published_at: string | null;
  domain: string;
  source_type:
    | "primary_interview"
    | "official_document"
    | "article"
    | "documentation"
    | "dataset"
    | "other";
  body: string;
  content_hash: string;
  retrieved_at: string;
};

type SourceChunkRow = {
  id: string;
  source_id: string;
  project_id: string;
  chunk_index: number;
  body: string;
  start_char: number;
  end_char: number;
  embedding_model: "text-embedding-3-small";
  embedding_dimensions: 1536;
};

type ClaimRow = {
  id: string;
  project_id: string;
  statement: string;
  normalized_key: string;
  claim_type: "factual" | "causal" | "comparative" | "definition";
  qualifiers: string[];
  confidence: number;
  review_status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type EvidenceLinkRow = {
  id: string;
  claim_id: string;
  chunk_id: string;
  project_id: string;
  relation: "supports" | "rebuts" | "qualifies" | "context";
  strength: "weak" | "moderate" | "strong";
  quote: string;
  rationale: string;
};

type ClaimRelationRow = {
  id: string;
  project_id: string;
  from_claim_id: string;
  to_claim_id: string;
  relation: "contradicts" | "duplicates" | "depends_on";
  rationale: string;
};

type RunLogRow = {
  id: string;
  run_id: string;
  project_id: string;
  step:
    | "planning"
    | "searching"
    | "collecting"
    | "indexing"
    | "extracting_claims"
    | "linking_evidence"
    | "detecting_conflicts"
    | "drafting_report";
  status: "started" | "completed" | "failed" | "skipped";
  attempt: number;
  occurred_at: string;
  error_code: string | null;
};

export type ManagedWorkspaceRows = {
  project: ProjectRow;
  run: ResearchRunRow;
  sources: SourceRow[];
  chunks: SourceChunkRow[];
  claims: ClaimRow[];
  evidenceLinks: EvidenceLinkRow[];
  claimRelations: ClaimRelationRow[];
  runLogs: RunLogRow[];
  reports: ReportRow[];
};

export type ManagedWorkspaceQueryAdapter = {
  getProject: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<ProjectRow | null>;
  getLatestRun: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<ResearchRunRow | null>;
  listSources: (input: { projectId: string }) => Promise<SourceRow[]>;
  listChunks: (input: { projectId: string }) => Promise<SourceChunkRow[]>;
  listClaims: (input: { projectId: string }) => Promise<ClaimRow[]>;
  listEvidenceLinks: (input: { projectId: string }) => Promise<EvidenceLinkRow[]>;
  listClaimRelations: (input: { projectId: string }) => Promise<ClaimRelationRow[]>;
  listRunLogs: (input: { projectId: string; runId: string }) => Promise<RunLogRow[]>;
  listReports: (input: { projectId: string }) => Promise<ReportRow[]>;
};

export type ManagedWorkspaceResult =
  | { state: "queued" | "running"; runId: string }
  | {
      state: "failed";
      runId: string;
      errorCode: string | null;
      canRetryDispatch: boolean;
    }
  | { state: "ready"; data: EvidenceWorkspaceData }
  | { state: "not-found" };

const projectColumns =
  "id,owner_id,title,question,status,visibility,slug,created_at,updated_at";
const runColumns =
  "id,project_id,owner_id,status,step,source_limit,manual_url_limit,max_content_chars,estimated_cost_usd,search_count,token_count,error_message,created_at,updated_at";
const sourceColumns =
  "id,project_id,canonical_url,title,author,published_at,domain,source_type,body,content_hash,retrieved_at";
const chunkColumns =
  "id,source_id,project_id,chunk_index,body,start_char,end_char,embedding_model,embedding_dimensions";
const claimColumns =
  "id,project_id,statement,normalized_key,claim_type,qualifiers,confidence,review_status,created_at";
const evidenceLinkColumns =
  "id,claim_id,chunk_id,project_id,relation,strength,quote,rationale";
const claimRelationColumns =
  "id,project_id,from_claim_id,to_claim_id,relation,rationale";
const runLogColumns =
  "id,run_id,project_id,step,status,attempt,occurred_at,error_code";

const throwQueryError = (error: { message: string } | null) => {
  if (error) {
    throw error;
  }
};

export const createSupabaseManagedWorkspaceQueryAdapter = (
  client: SupabaseClient,
): ManagedWorkspaceQueryAdapter => ({
  getProject: async ({ ownerId, projectId }) => {
    const { data, error } = await client
      .from("projects")
      .select(projectColumns)
      .eq("owner_id", ownerId)
      .eq("id", projectId)
      .neq("status", "deleted")
      .maybeSingle();
    throwQueryError(error);
    return data as ProjectRow | null;
  },
  getLatestRun: async ({ ownerId, projectId }) => {
    const { data, error } = await client
      .from("research_runs")
      .select(runColumns)
      .eq("owner_id", ownerId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwQueryError(error);
    return data as ResearchRunRow | null;
  },
  listSources: async ({ projectId }) => {
    const { data, error } = await client
      .from("sources")
      .select(sourceColumns)
      .eq("project_id", projectId)
      .order("retrieved_at", { ascending: true });
    throwQueryError(error);
    return (data ?? []) as SourceRow[];
  },
  listChunks: async ({ projectId }) => {
    const { data, error } = await client
      .from("source_chunks")
      .select(chunkColumns)
      .eq("project_id", projectId)
      .order("source_id", { ascending: true })
      .order("chunk_index", { ascending: true });
    throwQueryError(error);
    return (data ?? []) as SourceChunkRow[];
  },
  listClaims: async ({ projectId }) => {
    const { data, error } = await client
      .from("claims")
      .select(claimColumns)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    throwQueryError(error);
    return (data ?? []) as ClaimRow[];
  },
  listEvidenceLinks: async ({ projectId }) => {
    const { data, error } = await client
      .from("evidence_links")
      .select(evidenceLinkColumns)
      .eq("project_id", projectId)
      .order("id", { ascending: true });
    throwQueryError(error);
    return (data ?? []) as EvidenceLinkRow[];
  },
  listClaimRelations: async ({ projectId }) => {
    const { data, error } = await client
      .from("claim_relations")
      .select(claimRelationColumns)
      .eq("project_id", projectId)
      .order("id", { ascending: true });
    throwQueryError(error);
    return (data ?? []) as ClaimRelationRow[];
  },
  listRunLogs: async ({ projectId, runId }) => {
    const { data, error } = await client
      .from("run_logs")
      .select(runLogColumns)
      .eq("project_id", projectId)
      .eq("run_id", runId)
      .order("occurred_at", { ascending: true });
    throwQueryError(error);
    return (data ?? []) as RunLogRow[];
  },
  listReports: async ({ projectId }) => {
    const { data, error } = await client
      .from("reports")
      .select(reportColumns)
      .eq("project_id", projectId)
      .order("version", { ascending: false });
    throwQueryError(error);
    return (data ?? []) as ReportRow[];
  },
});

const normalizeTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
};

const mapProject = (row: ProjectRow) =>
  projectSchema.parse({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    question: row.question,
    status: row.status,
    visibility: row.visibility,
    slug: row.slug,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  });

const mapRun = (row: ResearchRunRow) =>
  researchRunSchema.parse({
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    status: row.status,
    step: row.step,
    sourceLimit: row.source_limit,
    manualUrlLimit: row.manual_url_limit,
    maxContentChars: row.max_content_chars,
    estimatedCostUsd: Number(row.estimated_cost_usd),
    searchCount: row.search_count,
    tokenCount: row.token_count,
    errorMessage: row.error_message ?? undefined,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  });

const mapSource = (row: SourceRow) =>
  sourceSchema.parse({
    id: row.id,
    projectId: row.project_id,
    canonicalUrl: row.canonical_url,
    title: row.title,
    author: row.author ?? undefined,
    publishedAt: row.published_at ? normalizeTimestamp(row.published_at) : undefined,
    domain: row.domain,
    sourceType: row.source_type,
    body: row.body,
    contentHash: row.content_hash,
    retrievedAt: normalizeTimestamp(row.retrieved_at),
  });

const mapChunk = (row: SourceChunkRow) =>
  sourceChunkSchema.parse({
    id: row.id,
    sourceId: row.source_id,
    projectId: row.project_id,
    chunkIndex: row.chunk_index,
    text: row.body,
    startChar: row.start_char,
    endChar: row.end_char,
    embeddingModel: row.embedding_model,
    embeddingDimensions: row.embedding_dimensions,
  });

const mapClaim = (row: ClaimRow) =>
  claimSchema.parse({
    id: row.id,
    projectId: row.project_id,
    statement: row.statement,
    normalizedKey: row.normalized_key,
    claimType: row.claim_type,
    qualifiers: row.qualifiers,
    confidence: Number(row.confidence),
    reviewStatus: row.review_status,
    createdAt: normalizeTimestamp(row.created_at),
  });

const mapEvidenceLink = (row: EvidenceLinkRow) =>
  evidenceLinkSchema.parse({
    id: row.id,
    claimId: row.claim_id,
    chunkId: row.chunk_id,
    projectId: row.project_id,
    relation: row.relation,
    strength: row.strength,
    quote: row.quote,
    rationale: row.rationale,
  });

const mapClaimRelation = (row: ClaimRelationRow) =>
  claimRelationSchema.parse({
    id: row.id,
    projectId: row.project_id,
    fromClaimId: row.from_claim_id,
    toClaimId: row.to_claim_id,
    relation: row.relation,
    rationale: row.rationale,
  });

const mapRunLog = (row: RunLogRow) =>
  runLogEntrySchema.parse({
    id: row.id,
    runId: row.run_id,
    step: row.step,
    status: row.status,
    attempt: row.attempt,
    timestamp: normalizeTimestamp(row.occurred_at),
    errorCode: row.error_code ?? undefined,
  });

export const createManagedWorkspaceStore = (queries: ManagedWorkspaceQueryAdapter) => ({
  load: async ({
    ownerId,
    projectId,
    locale,
  }: {
    ownerId: string;
    projectId: string;
    locale: AppLocale;
  }): Promise<ManagedWorkspaceResult> => {
    const projectRow = await queries.getProject({ ownerId, projectId });
    if (!projectRow) {
      return { state: "not-found" };
    }

    const runRow = await queries.getLatestRun({ ownerId, projectId });
    if (!runRow) {
      return { state: "not-found" };
    }

    const run = mapRun(runRow);
    if (run.status === "queued" || run.status === "running") {
      return { state: run.status, runId: run.id };
    }

    if (run.status === "failed" || run.status === "cancelled") {
      return {
        state: "failed",
        runId: run.id,
        errorCode: run.errorMessage ?? null,
        canRetryDispatch: run.errorMessage === "RESEARCH_DISPATCH_FAILED",
      };
    }

    const [sources, chunks, claims, evidenceLinks, claimRelations, runLogs, reports] =
      await Promise.all([
        queries.listSources({ projectId }),
        queries.listChunks({ projectId }),
        queries.listClaims({ projectId }),
        queries.listEvidenceLinks({ projectId }),
        queries.listClaimRelations({ projectId }),
        queries.listRunLogs({ projectId, runId: run.id }),
        queries.listReports({ projectId }),
      ]);

    return {
      state: "ready",
      data: {
        locale,
        project: mapProject(projectRow),
        run,
        sources: sources.map(mapSource),
        chunks: chunks.map(mapChunk),
        claims: claims.map(mapClaim),
        evidenceLinks: evidenceLinks.map(mapEvidenceLink),
        claimRelations: claimRelations.map(mapClaimRelation),
        runLogs: runLogs.map(mapRunLog),
        reports: reports.map(mapReportRow),
      },
    };
  },
});
