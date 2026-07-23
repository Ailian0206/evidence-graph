import "server-only";

import type { ProviderEnvironment } from "@/providers/live/smoke-gate";

const LOCAL_LIVE_CONFIRMATION = "I_CONFIRM_LOCAL_PAID_RESEARCH";
const LOCAL_LIVE_COST_LIMIT_USD = 0.15;

export const readLocalResearchEnvironment = (
  environment: ProviderEnvironment = process.env,
) => {
  if (environment.RESEARCH_PROVIDER_MODE !== "live") {
    throw new Error("LOCAL_LIVE_RESEARCH_LIVE_MODE_REQUIRED");
  }

  if (environment.ALLOW_LOCAL_LIVE_RESEARCH !== LOCAL_LIVE_CONFIRMATION) {
    throw new Error("LOCAL_LIVE_RESEARCH_NOT_CONFIRMED");
  }

  const costLimitUsd = Number(environment.LOCAL_LIVE_RESEARCH_COST_LIMIT_USD);

  if (
    !Number.isFinite(costLimitUsd) ||
    costLimitUsd <= 0 ||
    costLimitUsd > LOCAL_LIVE_COST_LIMIT_USD
  ) {
    throw new Error("LOCAL_LIVE_RESEARCH_COST_LIMIT_INVALID");
  }

  return { costLimitUsd };
};

export const localResearchConstants = {
  liveConfirmation: LOCAL_LIVE_CONFIRMATION,
  maximumCostLimitUsd: LOCAL_LIVE_COST_LIMIT_USD,
} as const;
