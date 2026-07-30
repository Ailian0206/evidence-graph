import "server-only";

type EvidenceEvalEnvironment = Record<string, string | undefined>;

const LIVE_CONFIRMATION = "I_CONFIRM_PAID_EVIDENCE_EVAL";
const MAXIMUM_TOTAL_COST_USD = 0.5;
const MAXIMUM_RUN_COST_USD = 0.15;
const COLLECTION_SOURCE_LIMIT = 6;
const MINIMUM_EVIDENCE_DOMAINS = 4;

const roundUsd = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const floorUsd = (value: number) => Math.floor(value * 1_000_000) / 1_000_000;

export const readLiveEvidenceEvalEnvironment = (
  environment: EvidenceEvalEnvironment = process.env,
) => {
  if (environment.RESEARCH_PROVIDER_MODE !== "live") {
    throw new Error("EVIDENCE_EVAL_LIVE_MODE_REQUIRED");
  }

  if (environment.ALLOW_PAID_EVIDENCE_EVAL !== LIVE_CONFIRMATION) {
    throw new Error("EVIDENCE_EVAL_NOT_CONFIRMED");
  }

  const totalCostLimitUsd = Number(environment.EVIDENCE_EVAL_TOTAL_COST_LIMIT_USD);
  if (
    !Number.isFinite(totalCostLimitUsd) ||
    totalCostLimitUsd <= 0 ||
    totalCostLimitUsd > MAXIMUM_TOTAL_COST_USD
  ) {
    throw new Error("EVIDENCE_EVAL_COST_LIMIT_INVALID");
  }

  const previousEstimatedCostUsd = Number(
    environment.EVIDENCE_EVAL_PREVIOUS_COST_USD ?? 0,
  );
  if (
    !Number.isFinite(previousEstimatedCostUsd) ||
    previousEstimatedCostUsd < 0 ||
    previousEstimatedCostUsd >= totalCostLimitUsd
  ) {
    throw new Error("EVIDENCE_EVAL_COST_LIMIT_INVALID");
  }

  return { totalCostLimitUsd, previousEstimatedCostUsd };
};

export const createLiveEvidenceEvalBudget = ({
  runCount,
  totalCostLimitUsd,
  previousEstimatedCostUsd = 0,
}: {
  runCount: number;
  totalCostLimitUsd: number;
  previousEstimatedCostUsd?: number;
}) => {
  if (
    !Number.isInteger(runCount) ||
    runCount < 1 ||
    !Number.isFinite(totalCostLimitUsd) ||
    totalCostLimitUsd <= 0 ||
    totalCostLimitUsd > MAXIMUM_TOTAL_COST_USD ||
    !Number.isFinite(previousEstimatedCostUsd) ||
    previousEstimatedCostUsd < 0 ||
    previousEstimatedCostUsd >= totalCostLimitUsd
  ) {
    throw new Error("EVIDENCE_EVAL_COST_LIMIT_INVALID");
  }

  const perRunCostLimitUsd = Math.min(
    MAXIMUM_RUN_COST_USD,
    floorUsd((totalCostLimitUsd - previousEstimatedCostUsd) / runCount),
  );
  if (perRunCostLimitUsd <= 0) {
    throw new Error("EVIDENCE_EVAL_COST_LIMIT_INVALID");
  }
  let totalEstimatedCostUsd = roundUsd(previousEstimatedCostUsd);

  return {
    perRunCostLimitUsd,
    get totalEstimatedCostUsd() {
      return totalEstimatedCostUsd;
    },
    recordRunCost: (estimatedCostUsd: number) => {
      if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0) {
        throw new Error("EVIDENCE_EVAL_COST_INVALID");
      }

      const nextTotal = roundUsd(totalEstimatedCostUsd + estimatedCostUsd);
      if (nextTotal > totalCostLimitUsd) {
        throw new Error("EVIDENCE_EVAL_COST_LIMIT_EXCEEDED");
      }

      totalEstimatedCostUsd = nextTotal;
    },
  };
};

export const liveEvidenceEvalConstants = {
  collectionSourceLimit: COLLECTION_SOURCE_LIMIT,
  confirmation: LIVE_CONFIRMATION,
  maximumTotalCostUsd: MAXIMUM_TOTAL_COST_USD,
  maximumRunCostUsd: MAXIMUM_RUN_COST_USD,
  minimumEvidenceDomains: MINIMUM_EVIDENCE_DOMAINS,
} as const;
