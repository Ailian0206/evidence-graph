import "server-only";

export type ProviderEnvironment = Record<string, string | undefined>;

const LIVE_CONFIRMATION = "I_CONFIRM_PAID_PROVIDER_CALLS";
const LIVE_COST_LIMIT_USD = 0.1;
export const MINIMUM_LIVE_SMOKE_BUDGET_USD = 0.01;

type CostedProviderResult = {
  usage: { estimatedCostUsd: number };
};

export type PaidProviderSmokeBudget = {
  readonly costLimitUsd: number;
  readonly totalEstimatedCostUsd: number;
  assertCanRunNext: () => void;
  recordActualCost: (estimatedCostUsd: number) => void;
};

const roundUsd = (value: number) => Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;

export const readPaidProviderSmokeEnvironment = (
  environment: ProviderEnvironment = process.env,
) => {
  if (environment.RESEARCH_PROVIDER_MODE !== "live") {
    throw new Error("PAID_PROVIDER_SMOKE_LIVE_MODE_REQUIRED");
  }

  if (environment.ALLOW_PAID_PROVIDER_SMOKE !== LIVE_CONFIRMATION) {
    throw new Error("PAID_PROVIDER_SMOKE_NOT_CONFIRMED");
  }

  const costLimitUsd = Number(environment.PAID_PROVIDER_SMOKE_COST_LIMIT_USD);

  if (
    !Number.isFinite(costLimitUsd) ||
    costLimitUsd <= 0 ||
    costLimitUsd > LIVE_COST_LIMIT_USD
  ) {
    throw new Error("PAID_PROVIDER_SMOKE_COST_LIMIT_INVALID");
  }

  return { costLimitUsd };
};

export const createPaidProviderSmokeBudget = (
  costLimitUsd: number,
): PaidProviderSmokeBudget => {
  if (
    !Number.isFinite(costLimitUsd) ||
    costLimitUsd <= 0 ||
    costLimitUsd > LIVE_COST_LIMIT_USD
  ) {
    throw new Error("PAID_PROVIDER_SMOKE_COST_LIMIT_INVALID");
  }

  if (costLimitUsd < MINIMUM_LIVE_SMOKE_BUDGET_USD) {
    throw new Error("PAID_PROVIDER_SMOKE_BUDGET_TOO_LOW");
  }

  let totalEstimatedCostUsd = 0;

  return {
    costLimitUsd,
    get totalEstimatedCostUsd() {
      return totalEstimatedCostUsd;
    },
    assertCanRunNext: () => {
      if (totalEstimatedCostUsd >= costLimitUsd) {
        throw new Error("PAID_PROVIDER_SMOKE_COST_LIMIT_EXCEEDED");
      }
    },
    recordActualCost: (estimatedCostUsd) => {
      if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0) {
        throw new Error("PAID_PROVIDER_SMOKE_COST_INVALID");
      }

      totalEstimatedCostUsd = roundUsd(
        totalEstimatedCostUsd + estimatedCostUsd,
      );

      if (totalEstimatedCostUsd > costLimitUsd) {
        throw new Error("PAID_PROVIDER_SMOKE_COST_LIMIT_EXCEEDED");
      }
    },
  };
};

export const runPaidProviderSmokeSequence = async <
  TTavily extends CostedProviderResult,
  TDeepSeek extends CostedProviderResult,
  TBailian extends CostedProviderResult,
>({
  budget,
  runTavily,
  runDeepSeek,
  runBailian,
}: {
  budget: PaidProviderSmokeBudget;
  runTavily: () => Promise<TTavily>;
  runDeepSeek: () => Promise<TDeepSeek>;
  runBailian: () => Promise<TBailian>;
}) => {
  budget.assertCanRunNext();
  const tavily = await runTavily();
  budget.recordActualCost(tavily.usage.estimatedCostUsd);

  budget.assertCanRunNext();
  const deepSeek = await runDeepSeek();
  budget.recordActualCost(deepSeek.usage.estimatedCostUsd);

  budget.assertCanRunNext();
  const bailian = await runBailian();
  budget.recordActualCost(bailian.usage.estimatedCostUsd);

  return {
    tavily,
    deepSeek,
    bailian,
    totalEstimatedCostUsd: budget.totalEstimatedCostUsd,
  };
};

export const paidProviderSmokeConstants = {
  liveConfirmation: LIVE_CONFIRMATION,
  localLiveCostLimitUsd: LIVE_COST_LIMIT_USD,
  minimumLiveSmokeBudgetUsd: MINIMUM_LIVE_SMOKE_BUDGET_USD,
} as const;
