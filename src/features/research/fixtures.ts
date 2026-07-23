import type {
  Claim,
  ClaimRelation,
  EvidenceLink,
  Project,
  ResearchRun,
  Source,
  SourceChunk,
} from "@/features/research/domain";
import { createClaimKey } from "@/features/claims/claim-utils";
import { canonicalizeUrl, chunkSourceText, createContentHash, extractDomain } from "@/features/sources/source-utils";

const FIXED_NOW = "2026-07-15T00:00:00.000Z";

export type DemoResearchFixture = {
  projects: Project[];
  researchRuns: ResearchRun[];
  sources: Source[];
  chunks: SourceChunk[];
  claims: Claim[];
  evidenceLinks: EvidenceLink[];
  claimRelations: ClaimRelation[];
};

export const createDemoResearchFixture = (): DemoResearchFixture => {
  const project: Project = {
    id: "project_demo",
    ownerId: "user_ailian",
    title: "Evidence Graph vs AI search",
    question: "How is Evidence Graph different from normal AI search summaries?",
    language: "en",
    status: "active",
    visibility: "private",
    slug: "evidence-graph-vs-ai-search",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  const researchRun: ResearchRun = {
    id: "run_demo",
    projectId: project.id,
    ownerId: project.ownerId,
    status: "queued",
    step: "queued",
    sourceLimit: 12,
    manualUrlLimit: 5,
    maxContentChars: 200000,
    estimatedCostUsd: 0,
    searchCount: 0,
    tokenCount: 0,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  const sourceBodies = [
    {
      id: "source_primary_interview",
      url: "https://example.com/research?utm_source=newsletter",
      title: "Product research interview",
      sourceType: "primary_interview" as const,
      body:
        "Evidence Graph keeps claims connected to exact quotes so reviewers can inspect source context.",
    },
    {
      id: "source_official_notes",
      url: "https://docs.example.com/evidence-graph",
      title: "Evidence Graph product notes",
      sourceType: "official_document" as const,
      body:
        "A cited report should use only claims with stored evidence links and preserved source excerpts.",
    },
  ];
  const sources: Source[] = sourceBodies.map((source) => ({
    id: source.id,
    projectId: project.id,
    canonicalUrl: canonicalizeUrl(source.url),
    title: source.title,
    domain: extractDomain(source.url),
    sourceType: source.sourceType,
    body: source.body,
    contentHash: createContentHash(source.body),
    retrievedAt: FIXED_NOW,
  }));
  const chunks = sources.flatMap((source) =>
    chunkSourceText({ sourceId: source.id, projectId: project.id, text: source.body }),
  );
  const claims: Claim[] = [
    {
      id: "claim_exact_quotes",
      projectId: project.id,
      statement: "Evidence Graph keeps claims connected to exact quotes.",
      normalizedKey: createClaimKey("Evidence Graph keeps claims connected to exact quotes."),
      claimType: "factual",
      qualifiers: ["MVP"],
      confidence: 0.86,
      reviewStatus: "pending",
      createdAt: FIXED_NOW,
    },
  ];
  const evidenceLinks: EvidenceLink[] = [
    {
      id: "link_exact_quotes",
      projectId: project.id,
      claimId: claims[0].id,
      chunkId: chunks[0].id,
      relation: "supports",
      strength: "strong",
      quote: "Evidence Graph keeps claims connected to exact quotes",
      rationale: "The interview directly states the claim and explains review context.",
    },
  ];

  return {
    projects: [project],
    researchRuns: [researchRun],
    sources,
    chunks,
    claims,
    evidenceLinks,
    claimRelations: [],
  };
};
