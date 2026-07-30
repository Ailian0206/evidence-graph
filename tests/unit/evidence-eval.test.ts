import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  evaluateEvidenceEval,
  evidenceEvalInputSchema,
} from "@/features/evaluation/evidence-eval";
import { createEvidenceEvalFixture } from "@/features/evaluation/evidence-eval-fixture";
import {
  EVIDENCE_EVAL_MANIFEST_VERSION,
  evidenceEvalManifest,
} from "@/features/evaluation/evidence-eval-manifest";

const cloneFixture = () => structuredClone(createEvidenceEvalFixture());

describe("Evidence Eval manifest", () => {
  it("freezes ten unique questions across the three MVP categories", () => {
    expect(EVIDENCE_EVAL_MANIFEST_VERSION).toBe("c4-v1");
    expect(evidenceEvalManifest).toHaveLength(10);
    expect(new Set(evidenceEvalManifest.map((item) => item.id)).size).toBe(10);
    expect(new Set(evidenceEvalManifest.map((item) => item.category))).toEqual(
      new Set(["technical", "competition", "market"]),
    );
    expect(evidenceEvalManifest.every((item) => item.question.trim().length > 0)).toBe(true);
  });
});

describe("Evidence Eval gate", () => {
  it("passes the deterministic ten-question fixture", () => {
    const summary = evaluateEvidenceEval(createEvidenceEvalFixture());

    expect(summary.passed).toBe(true);
    expect(summary.manifestVersion).toBe("c4-v1");
    expect(summary.caseResults).toHaveLength(10);
    expect(summary.failures).toEqual([]);
    expect(summary.metrics).toEqual({
      quoteExactness: {
        exact: 40,
        total: 40,
        value: 1,
        threshold: 1,
        passed: true,
      },
      uncitedFactualParagraphs: {
        count: 0,
        threshold: 0,
        passed: true,
      },
      evidenceRelationAccuracy: {
        correct: 40,
        sampled: 40,
        value: 1,
        threshold: 0.9,
        passed: true,
      },
      sourceDomainCoverage: {
        minimum: 4,
        passingCases: 10,
        totalCases: 10,
        value: 1,
        threshold: 0.9,
        requiredMinimum: 2,
        passed: true,
      },
      runCompletion: {
        ready: 10,
        total: 10,
        value: 1,
        threshold: 0.9,
        passed: true,
      },
      runCost: {
        maximumUsd: 0,
        totalUsd: 0,
        maximumAllowedUsd: 1,
        passed: true,
      },
    });
  });

  it("produces stable output for the same observation", () => {
    const input = createEvidenceEvalFixture();

    expect(evaluateEvidenceEval(input)).toEqual(evaluateEvidenceEval(input));
  });

  it("fails an inexact quote with the complete evidence path", () => {
    const input = cloneFixture();
    input.cases[0].evidenceLinks[0].quote = "A quote that is not in the chunk";

    const summary = evaluateEvidenceEval(input);

    expect(summary.metrics.quoteExactness.passed).toBe(false);
    expect(summary.failures).toContainEqual(
      expect.objectContaining({
        code: "QUOTE_NOT_EXACT",
        metric: "quoteExactness",
        caseId: "technical-vector-store",
        runId: "run_technical-vector-store",
        claimId: "claim_technical-vector-store",
        evidenceLinkId: "link_technical-vector-store_1",
        chunkId: "chunk_technical-vector-store_1",
        citationId: "link_technical-vector-store_1",
      }),
    );
  });

  it("fails a factual paragraph without a recognized citation", () => {
    const input = cloneFixture();
    input.cases[0].reports[0].paragraphs[0].citationIds = ["missing_citation"];

    const summary = evaluateEvidenceEval(input);

    expect(summary.metrics.uncitedFactualParagraphs).toMatchObject({
      count: 1,
      passed: false,
    });
    expect(summary.failures).toContainEqual(
      expect.objectContaining({
        code: "FACTUAL_PARAGRAPH_UNCITED",
        reportId: "report_technical-vector-store",
        paragraphId: "paragraph_technical-vector-store",
        citationId: "missing_citation",
      }),
    );
  });

  it("fails relation accuracy below ninety percent", () => {
    const input = cloneFixture();
    for (const item of input.cases.slice(0, 2)) {
      item.relationSamples[0].expectedRelation = "rebuts";
    }

    const summary = evaluateEvidenceEval(input);

    expect(summary.metrics.evidenceRelationAccuracy).toMatchObject({
      correct: 38,
      sampled: 40,
      value: 0.95,
      passed: true,
    });

    for (const item of input.cases.slice(2, 5)) {
      item.relationSamples[0].expectedRelation = "rebuts";
    }

    const failedSummary = evaluateEvidenceEval(input);
    expect(failedSummary.metrics.evidenceRelationAccuracy).toMatchObject({
      correct: 35,
      sampled: 40,
      value: 0.875,
      passed: false,
    });
    expect(failedSummary.failures).toContainEqual(
      expect.objectContaining({
        code: "EVIDENCE_RELATION_MISMATCH",
        claimId: "claim_technical-vector-store",
        evidenceLinkId: "link_technical-vector-store_1",
      }),
    );
  });

  it("requires two evidence domains in at least ninety percent of cases", () => {
    const input = cloneFixture();
    for (const source of input.cases[0].sources) {
      source.domain = "single.example";
    }

    const passingSummary = evaluateEvidenceEval(input);

    expect(passingSummary.passed).toBe(true);
    expect(passingSummary.metrics.sourceDomainCoverage).toEqual({
      minimum: 1,
      passingCases: 9,
      totalCases: 10,
      value: 0.9,
      threshold: 0.9,
      requiredMinimum: 2,
      passed: true,
    });
    expect(passingSummary.failures).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_DOMAIN_COVERAGE_LOW",
        caseId: "technical-vector-store",
        runId: "run_technical-vector-store",
      }),
    );

    for (const source of input.cases[1].sources) {
      source.domain = "another-single.example";
    }

    const failedSummary = evaluateEvidenceEval(input);
    expect(failedSummary.passed).toBe(false);
    expect(failedSummary.metrics.sourceDomainCoverage).toEqual({
      minimum: 1,
      passingCases: 8,
      totalCases: 10,
      value: 0.8,
      threshold: 0.9,
      requiredMinimum: 2,
      passed: false,
    });
  });

  it("fails completion below ninety percent", () => {
    const input = cloneFixture();
    input.cases[0].run.status = "failed";
    input.cases[1].run.status = "failed";

    const summary = evaluateEvidenceEval(input);

    expect(summary.metrics.runCompletion).toEqual({
      ready: 8,
      total: 10,
      value: 0.8,
      threshold: 0.9,
      passed: false,
    });
    expect(summary.failures).toContainEqual(
      expect.objectContaining({
        code: "RUN_NOT_READY",
        caseId: "technical-vector-store",
      }),
    );
  });

  it("fails any run whose estimated cost exceeds one dollar", () => {
    const input = cloneFixture();
    input.cases[0].run.estimatedCostUsd = 1.01;

    const summary = evaluateEvidenceEval(input);

    expect(summary.metrics.runCost).toEqual({
      maximumUsd: 1.01,
      totalUsd: 1.01,
      maximumAllowedUsd: 1,
      passed: false,
    });
    expect(summary.failures).toContainEqual(
      expect.objectContaining({
        code: "RUN_COST_LIMIT_EXCEEDED",
        caseId: "technical-vector-store",
      }),
    );
  });

  it("fails broken traceability references instead of dropping them", () => {
    const input = cloneFixture();
    input.cases[0].evidenceLinks[0].chunkId = "missing_chunk";

    const summary = evaluateEvidenceEval(input);

    expect(summary.passed).toBe(false);
    expect(summary.metrics.quoteExactness).toMatchObject({ total: 40, exact: 39 });
    expect(summary.failures).toContainEqual(
      expect.objectContaining({
        code: "TRACEABILITY_REFERENCE_MISSING",
        metric: "traceability",
        claimId: "claim_technical-vector-store",
        evidenceLinkId: "link_technical-vector-store_1",
        chunkId: "missing_chunk",
      }),
    );
  });

  it("rejects duplicate or missing manifest cases at the input boundary", () => {
    const input = cloneFixture();
    input.cases[1].caseId = input.cases[0].caseId;

    expect(() => evidenceEvalInputSchema.parse(input)).toThrow();
  });
});

describe("Evidence Eval CLI", () => {
  it("returns a non-zero exit and writes traceable JSON for a failed input", () => {
    const directory = mkdtempSync(join(tmpdir(), "evidence-eval-"));
    const inputPath = join(directory, "input.json");
    const outputPath = join(directory, "summary.json");
    const input = cloneFixture();
    input.cases[0].run.estimatedCostUsd = 1.01;
    writeFileSync(inputPath, JSON.stringify(input));

    const result = spawnSync(
      join(process.cwd(), "node_modules/.bin/jiti"),
      [
        "scripts/run-evidence-eval.ts",
        "--input",
        inputPath,
        "--output",
        outputPath,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(readFileSync(outputPath, "utf8"))).toMatchObject({
      passed: false,
      failures: [
        expect.objectContaining({
          code: "RUN_COST_LIMIT_EXCEEDED",
          caseId: "technical-vector-store",
          runId: "run_technical-vector-store",
        }),
      ],
    });
  });
});
