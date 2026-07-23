import { z } from "zod";

const isoDateSchema = z.string().datetime();
const idSchema = z.string().min(1);

export const projectStatusSchema = z.enum(["active", "archived", "deleted"]);
export const projectVisibilitySchema = z.enum(["private", "public"]);
export const runStepSchema = z.enum([
  "queued",
  "planning",
  "searching",
  "collecting",
  "indexing",
  "extracting_claims",
  "linking_evidence",
  "detecting_conflicts",
  "drafting_report",
  "ready",
  "failed",
  "cancelled",
]);
export const runStatusSchema = z.enum(["queued", "running", "ready", "failed", "cancelled"]);
export const sourceTypeSchema = z.enum([
  "primary_interview",
  "official_document",
  "article",
  "documentation",
  "dataset",
  "other",
]);
export const claimTypeSchema = z.enum(["factual", "causal", "comparative", "definition"]);
export const claimReviewStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export const evidenceRelationSchema = z.enum(["supports", "rebuts", "qualifies", "context"]);
export const evidenceStrengthSchema = z.enum(["weak", "moderate", "strong"]);
export const claimRelationTypeSchema = z.enum(["contradicts", "duplicates", "depends_on"]);
export const currentEmbeddingModel = "text-embedding-v4" as const;
export const embeddingModelSchema = z.enum([
  "text-embedding-3-small",
  currentEmbeddingModel,
]);

export const projectSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  title: z.string().min(1),
  question: z.string().min(1),
  language: z.enum(["zh", "en"]),
  status: projectStatusSchema,
  visibility: projectVisibilitySchema,
  slug: z.string().min(1),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const researchRunSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  ownerId: idSchema,
  status: runStatusSchema,
  step: runStepSchema,
  sourceLimit: z.number().int().min(1).max(12),
  manualUrlLimit: z.number().int().min(0).max(5),
  maxContentChars: z.number().int().positive().max(200000),
  estimatedCostUsd: z.number().min(0).max(1),
  searchCount: z.number().int().min(0),
  tokenCount: z.number().int().min(0),
  errorMessage: z.string().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const sourceSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  canonicalUrl: z.string().url(),
  title: z.string().min(1),
  author: z.string().optional(),
  publishedAt: isoDateSchema.optional(),
  domain: z.string().min(1),
  sourceType: sourceTypeSchema,
  body: z.string().min(1),
  contentHash: z.string().min(1),
  retrievedAt: isoDateSchema,
});

export const sourceChunkSchema = z.object({
  id: idSchema,
  sourceId: idSchema,
  projectId: idSchema,
  chunkIndex: z.number().int().min(0),
  text: z.string().min(1),
  startChar: z.number().int().min(0),
  endChar: z.number().int().min(1),
  embeddingModel: embeddingModelSchema,
  embeddingDimensions: z.literal(1536),
});

export const claimSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  statement: z.string().min(1),
  normalizedKey: z.string().min(1),
  claimType: claimTypeSchema,
  qualifiers: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  reviewStatus: claimReviewStatusSchema,
  createdAt: isoDateSchema,
});

export const evidenceLinkSchema = z.object({
  id: idSchema,
  claimId: idSchema,
  chunkId: idSchema,
  projectId: idSchema,
  relation: evidenceRelationSchema,
  strength: evidenceStrengthSchema,
  quote: z.string().min(1),
  rationale: z.string().min(1),
});

export const claimRelationSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  fromClaimId: idSchema,
  toClaimId: idSchema,
  relation: claimRelationTypeSchema,
  rationale: z.string().min(1),
});

export type Project = z.infer<typeof projectSchema>;
export type ResearchRun = z.infer<typeof researchRunSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type SourceChunk = z.infer<typeof sourceChunkSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;
export type ClaimRelation = z.infer<typeof claimRelationSchema>;
