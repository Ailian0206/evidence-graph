import { describe, expect, it } from "vitest";

import {
  createLiveEvidenceEvalBudget,
  liveEvidenceEvalConstants,
  readLiveEvidenceEvalEnvironment,
} from "@/features/evaluation/live-evidence-eval-gate";

const validEnvironment = {
  RESEARCH_PROVIDER_MODE: "live",
  ALLOW_PAID_EVIDENCE_EVAL: "I_CONFIRM_PAID_EVIDENCE_EVAL",
  EVIDENCE_EVAL_TOTAL_COST_LIMIT_USD: "0.50",
};

describe("live Evidence Eval gate", () => {
  it("allocates more source slots than the four-domain quality threshold", () => {
    expect(liveEvidenceEvalConstants.collectionSourceLimit).toBe(6);
    expect(liveEvidenceEvalConstants.minimumEvidenceDomains).toBe(4);
  });

  it("requires live mode and the dedicated confirmation", () => {
    expect(() =>
      readLiveEvidenceEvalEnvironment({
        ...validEnvironment,
        RESEARCH_PROVIDER_MODE: "fixture",
      }),
    ).toThrow("EVIDENCE_EVAL_LIVE_MODE_REQUIRED");
    expect(() =>
      readLiveEvidenceEvalEnvironment({
        ...validEnvironment,
        ALLOW_PAID_EVIDENCE_EVAL: "yes",
      }),
    ).toThrow("EVIDENCE_EVAL_NOT_CONFIRMED");
  });

  it("accepts only a positive aggregate cap up to fifty cents", () => {
    for (const value of ["", "0", "0.51", "not-a-number"]) {
      expect(() =>
        readLiveEvidenceEvalEnvironment({
          ...validEnvironment,
          EVIDENCE_EVAL_TOTAL_COST_LIMIT_USD: value,
        }),
      ).toThrow("EVIDENCE_EVAL_COST_LIMIT_INVALID");
    }

    expect(readLiveEvidenceEvalEnvironment(validEnvironment)).toEqual({
      totalCostLimitUsd: 0.5,
      previousEstimatedCostUsd: 0,
    });
  });

  it("allocates ten bounded runs without exceeding the aggregate cap", () => {
    const budget = createLiveEvidenceEvalBudget({
      runCount: 10,
      totalCostLimitUsd: 0.5,
    });

    expect(budget.perRunCostLimitUsd).toBe(0.05);
    expect(budget.perRunCostLimitUsd).toBeLessThanOrEqual(
      liveEvidenceEvalConstants.maximumRunCostUsd,
    );
    for (let index = 0; index < 10; index += 1) {
      budget.recordRunCost(0.04);
    }
    expect(budget.totalEstimatedCostUsd).toBe(0.4);
    expect(() => budget.recordRunCost(0.11)).toThrow(
      "EVIDENCE_EVAL_COST_LIMIT_EXCEEDED",
    );
  });

  it("deducts previous attempts before allocating the remaining run budget", () => {
    const environment = readLiveEvidenceEvalEnvironment({
      ...validEnvironment,
      EVIDENCE_EVAL_PREVIOUS_COST_USD: "0.20",
    });
    const budget = createLiveEvidenceEvalBudget({
      runCount: 10,
      ...environment,
    });

    expect(environment.previousEstimatedCostUsd).toBe(0.2);
    expect(budget.perRunCostLimitUsd).toBe(0.03);
    expect(budget.totalEstimatedCostUsd).toBe(0.2);
    expect(() => {
      for (let index = 0; index < 11; index += 1) {
        budget.recordRunCost(0.03);
      }
    }).toThrow("EVIDENCE_EVAL_COST_LIMIT_EXCEEDED");
  });

  it("rejects a remaining budget too small to allocate to every run", () => {
    expect(() =>
      createLiveEvidenceEvalBudget({
        runCount: 10,
        totalCostLimitUsd: 0.5,
        previousEstimatedCostUsd: 0.499_999,
      }),
    ).toThrow("EVIDENCE_EVAL_COST_LIMIT_INVALID");
  });
});
