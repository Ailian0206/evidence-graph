import { z } from "zod";

import {
  EVIDENCE_EVAL_MANIFEST_VERSION,
  evidenceEvalCategories,
  evidenceEvalManifest,
} from "./evidence-eval-manifest";

const evidenceRelationSchema = z.enum(["supports", "rebuts", "qualifies", "context"]);
const runStatusSchema = z.enum(["queued", "running", "ready", "failed", "cancelled"]);
const idSchema = z.string().min(1);

const evidenceEvalCaseSchema = z.object({
  caseId: idSchema,
  category: z.enum(evidenceEvalCategories),
  language: z.enum(["en", "zh"]),
  question: z.string().min(1),
  usableScenario: z.boolean(),
  run: z.object({
    id: idSchema,
    status: runStatusSchema,
    estimatedCostUsd: z.number().nonnegative(),
  }),
  sources: z.array(
    z.object({
      id: idSchema,
      domain: z.string().min(1),
    }),
  ),
  chunks: z.array(
    z.object({
      id: idSchema,
      sourceId: idSchema,
      text: z.string().min(1),
    }),
  ),
  evidenceLinks: z.array(
    z.object({
      id: idSchema,
      claimId: idSchema,
      chunkId: idSchema,
      relation: evidenceRelationSchema,
      quote: z.string().min(1),
    }),
  ),
  reports: z.array(
    z.object({
      id: idSchema,
      paragraphs: z.array(
        z.object({
          id: idSchema,
          factual: z.boolean(),
          citationIds: z.array(idSchema),
        }),
      ),
    }),
  ),
  relationSamples: z.array(
    z.object({
      evidenceLinkId: idSchema,
      expectedRelation: evidenceRelationSchema,
    }),
  ),
});

export const evidenceEvalInputSchema = z
  .object({
    manifestVersion: z.literal(EVIDENCE_EVAL_MANIFEST_VERSION),
    cases: z.array(evidenceEvalCaseSchema),
  })
  .superRefine(({ cases }, context) => {
    const expectedById = new Map<string, (typeof evidenceEvalManifest)[number]>(
      evidenceEvalManifest.map((item) => [item.id, item]),
    );
    const seen = new Set<string>();

    for (const [index, item] of cases.entries()) {
      const expected = expectedById.get(item.caseId);
      if (seen.has(item.caseId) || !expected) {
        context.addIssue({
          code: "custom",
          message: "EVIDENCE_EVAL_CASE_INVALID",
          path: ["cases", index, "caseId"],
        });
        continue;
      }

      seen.add(item.caseId);
      if (
        item.category !== expected.category ||
        item.language !== expected.language ||
        item.question !== expected.question
      ) {
        context.addIssue({
          code: "custom",
          message: "EVIDENCE_EVAL_MANIFEST_MISMATCH",
          path: ["cases", index],
        });
      }
    }

    if (seen.size !== evidenceEvalManifest.length) {
      context.addIssue({
        code: "custom",
        message: "EVIDENCE_EVAL_CASE_SET_INCOMPLETE",
        path: ["cases"],
      });
    }
  });

export type EvidenceEvalInput = z.infer<typeof evidenceEvalInputSchema>;
export type EvidenceEvalMetric =
  | "quoteExactness"
  | "uncitedFactualParagraphs"
  | "evidenceRelationAccuracy"
  | "sourceDomainCoverage"
  | "runCompletion"
  | "runCost"
  | "traceability";

export type EvidenceEvalFailure = {
  code:
    | "QUOTE_NOT_EXACT"
    | "FACTUAL_PARAGRAPH_UNCITED"
    | "EVIDENCE_RELATION_MISMATCH"
    | "RELATION_SAMPLE_MISSING"
    | "SOURCE_DOMAIN_COVERAGE_LOW"
    | "RUN_NOT_READY"
    | "RUN_COST_LIMIT_EXCEEDED"
    | "TRACEABILITY_REFERENCE_MISSING";
  metric: EvidenceEvalMetric;
  caseId: string;
  runId: string;
  claimId?: string;
  evidenceLinkId?: string;
  chunkId?: string;
  sourceId?: string;
  reportId?: string;
  paragraphId?: string;
  citationId?: string;
};

export const evidenceEvalThresholds = {
  quoteExactness: 1,
  uncitedFactualParagraphs: 0,
  evidenceRelationAccuracy: 0.9,
  sourceDomains: 4,
  runCompletion: 0.9,
  maximumRunCostUsd: 1,
  maximumLiveTotalCostUsd: 0.5,
  maximumLocalLiveRunCostUsd: 0.15,
} as const;

const roundMetric = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export const evaluateEvidenceEval = (rawInput: EvidenceEvalInput) => {
  const input = evidenceEvalInputSchema.parse(rawInput);
  const casesById = new Map(input.cases.map((item) => [item.caseId, item]));
  const failures: EvidenceEvalFailure[] = [];
  const caseResults = [];
  let exactQuotes = 0;
  let totalQuotes = 0;
  let uncitedFactualParagraphs = 0;
  let correctRelations = 0;
  let sampledRelations = 0;
  let readyRuns = 0;
  let maximumRunCostUsd = 0;
  let totalRunCostUsd = 0;
  const completedUsableDomainCounts: number[] = [];

  for (const manifestItem of evidenceEvalManifest) {
    const item = casesById.get(manifestItem.id);
    if (!item) {
      throw new Error("EVIDENCE_EVAL_CASE_SET_INCOMPLETE");
    }
    const failureStart = failures.length;
    const sourcesById = new Map(item.sources.map((source) => [source.id, source]));
    const chunksById = new Map(item.chunks.map((chunk) => [chunk.id, chunk]));
    const linksById = new Map(item.evidenceLinks.map((link) => [link.id, link]));
    const evidenceDomains = new Set<string>();
    let caseExactQuotes = 0;
    let caseUncitedParagraphs = 0;
    let caseCorrectRelations = 0;

    if (item.run.status === "ready") {
      readyRuns += 1;
    } else {
      failures.push({
        code: "RUN_NOT_READY",
        metric: "runCompletion",
        caseId: item.caseId,
        runId: item.run.id,
      });
    }

    maximumRunCostUsd = Math.max(maximumRunCostUsd, item.run.estimatedCostUsd);
    totalRunCostUsd = roundMetric(totalRunCostUsd + item.run.estimatedCostUsd);
    if (item.run.estimatedCostUsd > evidenceEvalThresholds.maximumRunCostUsd) {
      failures.push({
        code: "RUN_COST_LIMIT_EXCEEDED",
        metric: "runCost",
        caseId: item.caseId,
        runId: item.run.id,
      });
    }

    for (const link of item.evidenceLinks) {
      totalQuotes += 1;
      const chunk = chunksById.get(link.chunkId);
      if (!chunk) {
        failures.push({
          code: "TRACEABILITY_REFERENCE_MISSING",
          metric: "traceability",
          caseId: item.caseId,
          runId: item.run.id,
          claimId: link.claimId,
          evidenceLinkId: link.id,
          chunkId: link.chunkId,
          citationId: link.id,
        });
        continue;
      }

      const source = sourcesById.get(chunk.sourceId);
      if (!source) {
        failures.push({
          code: "TRACEABILITY_REFERENCE_MISSING",
          metric: "traceability",
          caseId: item.caseId,
          runId: item.run.id,
          claimId: link.claimId,
          evidenceLinkId: link.id,
          chunkId: chunk.id,
          sourceId: chunk.sourceId,
          citationId: link.id,
        });
      } else {
        evidenceDomains.add(source.domain);
      }

      if (chunk.text.includes(link.quote)) {
        exactQuotes += 1;
        caseExactQuotes += 1;
      } else {
        failures.push({
          code: "QUOTE_NOT_EXACT",
          metric: "quoteExactness",
          caseId: item.caseId,
          runId: item.run.id,
          claimId: link.claimId,
          evidenceLinkId: link.id,
          chunkId: chunk.id,
          sourceId: chunk.sourceId,
          citationId: link.id,
        });
      }
    }

    for (const report of item.reports) {
      for (const paragraph of report.paragraphs) {
        if (!paragraph.factual) {
          continue;
        }

        const recognizedCitations = paragraph.citationIds.filter((citationId) =>
          linksById.has(citationId),
        );
        for (const citationId of paragraph.citationIds) {
          if (!linksById.has(citationId)) {
            failures.push({
              code: "TRACEABILITY_REFERENCE_MISSING",
              metric: "traceability",
              caseId: item.caseId,
              runId: item.run.id,
              reportId: report.id,
              paragraphId: paragraph.id,
              citationId,
            });
          }
        }

        if (recognizedCitations.length === 0) {
          uncitedFactualParagraphs += 1;
          caseUncitedParagraphs += 1;
          failures.push({
            code: "FACTUAL_PARAGRAPH_UNCITED",
            metric: "uncitedFactualParagraphs",
            caseId: item.caseId,
            runId: item.run.id,
            reportId: report.id,
            paragraphId: paragraph.id,
            citationId: paragraph.citationIds[0],
          });
        }
      }
    }

    if (item.run.status === "ready" && item.reports.length === 0) {
      failures.push({
        code: "TRACEABILITY_REFERENCE_MISSING",
        metric: "traceability",
        caseId: item.caseId,
        runId: item.run.id,
      });
    }

    if (item.relationSamples.length === 0) {
      failures.push({
        code: "RELATION_SAMPLE_MISSING",
        metric: "evidenceRelationAccuracy",
        caseId: item.caseId,
        runId: item.run.id,
      });
    }

    for (const sample of item.relationSamples) {
      sampledRelations += 1;
      const link = linksById.get(sample.evidenceLinkId);
      if (!link) {
        failures.push({
          code: "TRACEABILITY_REFERENCE_MISSING",
          metric: "traceability",
          caseId: item.caseId,
          runId: item.run.id,
          evidenceLinkId: sample.evidenceLinkId,
        });
      } else if (link.relation === sample.expectedRelation) {
        correctRelations += 1;
        caseCorrectRelations += 1;
      } else {
        failures.push({
          code: "EVIDENCE_RELATION_MISMATCH",
          metric: "evidenceRelationAccuracy",
          caseId: item.caseId,
          runId: item.run.id,
          claimId: link.claimId,
          evidenceLinkId: link.id,
          chunkId: link.chunkId,
          citationId: link.id,
        });
      }
    }

    if (item.usableScenario && item.run.status === "ready") {
      completedUsableDomainCounts.push(evidenceDomains.size);
      if (evidenceDomains.size < evidenceEvalThresholds.sourceDomains) {
        failures.push({
          code: "SOURCE_DOMAIN_COVERAGE_LOW",
          metric: "sourceDomainCoverage",
          caseId: item.caseId,
          runId: item.run.id,
        });
      }
    }

    caseResults.push({
      caseId: item.caseId,
      category: item.category,
      runId: item.run.id,
      ready: item.run.status === "ready",
      exactQuotes: caseExactQuotes,
      totalQuotes: item.evidenceLinks.length,
      uncitedFactualParagraphs: caseUncitedParagraphs,
      correctRelations: caseCorrectRelations,
      sampledRelations: item.relationSamples.length,
      sourceDomainCount: evidenceDomains.size,
      estimatedCostUsd: item.run.estimatedCostUsd,
      passed: failures.length === failureStart,
    });
  }

  const quoteValue = totalQuotes === 0 ? 0 : roundMetric(exactQuotes / totalQuotes);
  const relationValue =
    sampledRelations === 0 ? 0 : roundMetric(correctRelations / sampledRelations);
  const completionValue = roundMetric(readyRuns / evidenceEvalManifest.length);
  const minimumSourceDomains =
    completedUsableDomainCounts.length === 0
      ? 0
      : Math.min(...completedUsableDomainCounts);
  const hasTraceabilityFailure = failures.some((failure) => failure.metric === "traceability");
  const metrics = {
    quoteExactness: {
      exact: exactQuotes,
      total: totalQuotes,
      value: quoteValue,
      threshold: evidenceEvalThresholds.quoteExactness,
      passed:
        totalQuotes > 0 &&
        quoteValue === evidenceEvalThresholds.quoteExactness,
    },
    uncitedFactualParagraphs: {
      count: uncitedFactualParagraphs,
      threshold: evidenceEvalThresholds.uncitedFactualParagraphs,
      passed:
        uncitedFactualParagraphs === evidenceEvalThresholds.uncitedFactualParagraphs,
    },
    evidenceRelationAccuracy: {
      correct: correctRelations,
      sampled: sampledRelations,
      value: relationValue,
      threshold: evidenceEvalThresholds.evidenceRelationAccuracy,
      passed:
        sampledRelations > 0 &&
        relationValue >= evidenceEvalThresholds.evidenceRelationAccuracy,
    },
    sourceDomainCoverage: {
      minimum: minimumSourceDomains,
      requiredMinimum: evidenceEvalThresholds.sourceDomains,
      passed:
        completedUsableDomainCounts.length > 0 &&
        minimumSourceDomains >= evidenceEvalThresholds.sourceDomains,
    },
    runCompletion: {
      ready: readyRuns,
      total: evidenceEvalManifest.length,
      value: completionValue,
      threshold: evidenceEvalThresholds.runCompletion,
      passed: completionValue >= evidenceEvalThresholds.runCompletion,
    },
    runCost: {
      maximumUsd: roundMetric(maximumRunCostUsd),
      totalUsd: roundMetric(totalRunCostUsd),
      maximumAllowedUsd: evidenceEvalThresholds.maximumRunCostUsd,
      passed: maximumRunCostUsd <= evidenceEvalThresholds.maximumRunCostUsd,
    },
  };

  return {
    manifestVersion: input.manifestVersion,
    passed: Object.values(metrics).every((metric) => metric.passed) && !hasTraceabilityFailure,
    metrics,
    caseResults,
    failures,
  };
};

export type EvidenceEvalSummary = ReturnType<typeof evaluateEvidenceEval>;
