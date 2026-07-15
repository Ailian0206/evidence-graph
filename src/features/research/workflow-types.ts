import { z } from "zod";

import {
  claimRelationTypeSchema,
  claimTypeSchema,
  evidenceRelationSchema,
  evidenceStrengthSchema,
} from "@/features/research/domain";

export const searchPlanSchema = z.object({
  queries: z.array(z.string().min(1)).min(3).max(5),
});

export const claimCandidatesSchema = z
  .object({
    claims: z.array(
      z.object({
        candidateId: z.string().min(1),
        statement: z.string().min(1),
        claimType: claimTypeSchema,
        qualifiers: z.array(z.string()),
        confidence: z.number().min(0).max(1),
      }),
    ),
  })
  .superRefine(({ claims }, context) => {
    const candidateIds = new Set<string>();

    for (const [index, claim] of claims.entries()) {
      if (candidateIds.has(claim.candidateId)) {
        context.addIssue({
          code: "custom",
          message: "CLAIM_CANDIDATE_ID_CONFLICT",
          path: ["claims", index, "candidateId"],
        });
      }

      candidateIds.add(claim.candidateId);
    }
  });

export const extractedClaimsOutputSchema = claimCandidatesSchema.extend({
  claimIdsByCandidate: z.record(z.string().min(1), z.string().min(1)),
});

export const evidenceCandidatesSchema = z.object({
  evidence: z.array(
    z.object({
      claimCandidateId: z.string().min(1),
      sourceUrl: z.string().url(),
      quote: z.string().min(1),
      relation: evidenceRelationSchema,
      strength: evidenceStrengthSchema,
      rationale: z.string().min(1),
    }),
  ),
});

export const conflictCandidatesSchema = z.object({
  relations: z.array(
    z.object({
      fromClaimCandidateId: z.string().min(1),
      toClaimCandidateId: z.string().min(1),
      relation: claimRelationTypeSchema,
      rationale: z.string().min(1),
    }),
  ),
});

export const reportDraftSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().min(1),
      heading: z.string().min(1),
      factual: z.boolean(),
      paragraphs: z
        .array(
          z.object({
            markdown: z.string().min(1),
            claimIds: z.array(z.string().min(1)).min(1),
          }),
        )
        .min(1),
    }),
  ),
});

export const workflowStepSchema = z.enum([
  "planning",
  "searching",
  "collecting",
  "indexing",
  "extracting_claims",
  "linking_evidence",
  "detecting_conflicts",
  "drafting_report",
]);

export const workflowCheckpointSchema = z.object({
  runId: z.string().min(1),
  step: workflowStepSchema,
  idempotencyKey: z.string().min(1),
  output: z.unknown(),
  completedAt: z.string().datetime(),
});

export const runLogEntrySchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  step: workflowStepSchema,
  status: z.enum(["started", "completed", "failed", "skipped"]),
  attempt: z.number().int().positive(),
  timestamp: z.string().datetime(),
  errorCode: z.string().min(1).optional(),
});

export const embeddedChunkSchema = z.object({
  chunkId: z.string().min(1),
  model: z.literal("text-embedding-3-small"),
  dimensions: z.literal(1536),
  vector: z.array(z.number()).length(1536),
});

export const reportSectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  factual: z.boolean(),
  markdown: z.string().min(1),
  citationIds: z.array(z.string().min(1)),
});

export const reportCitationSchema = z.object({
  evidenceLinkId: z.string().min(1),
  claimId: z.string().min(1),
  chunkId: z.string().min(1),
  sourceId: z.string().min(1),
  quote: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(1),
});

export const researchReportSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  projectId: z.string().min(1),
  markdown: z.string().min(1),
  sections: z.array(reportSectionSchema).min(1),
  citations: z.array(reportCitationSchema),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowCheckpoint = z.infer<typeof workflowCheckpointSchema>;
export type RunLogEntry = z.infer<typeof runLogEntrySchema>;
export type EmbeddedChunk = z.infer<typeof embeddedChunkSchema>;
export type ResearchReport = z.infer<typeof researchReportSchema>;
