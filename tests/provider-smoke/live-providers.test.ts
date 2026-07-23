import { describe, expect, it } from "vitest";

import { searchPlanSchema } from "@/features/research/workflow-types";
import { runPaidProviderSmokeSequence } from "@/providers/live/smoke-gate";
import { createPaidProviderSmokeRuntime } from "@/providers/runtime";

describe("live Provider smoke", () => {
  it("executes one bounded request against each live Provider", async () => {
    const { providers, budget, costLimitUsd } = createPaidProviderSmokeRuntime();
    const idempotencyPrefix = `provider-smoke:${Date.now()}`;

    const result = await runPaidProviderSmokeSequence({
      budget,
      runTavily: async () => {
        const search = await providers.search.search({
          query: "Tavily Search API official documentation",
          maxResults: 1,
          idempotencyKey: `${idempotencyPrefix}:tavily`,
        });
        expect(search.data).toHaveLength(1);
        return search;
      },
      runDeepSeek: async () => {
        const plan = await providers.languageModel.generateStructured({
          operation: "plan",
          schema: searchPlanSchema,
          payload: {
            question:
              "What official documentation should a minimal API smoke test verify?",
            language: "en",
          },
          idempotencyKey: `${idempotencyPrefix}:deepseek`,
        });
        expect(plan.data.queries.length).toBeGreaterThanOrEqual(3);
        return plan;
      },
      runBailian: async () => {
        const embedding = await providers.embedding.embed({
          texts: ["minimal live Provider smoke test"],
          idempotencyKey: `${idempotencyPrefix}:bailian`,
        });
        expect(embedding.data).toHaveLength(1);
        expect(embedding.data[0]).toHaveLength(1536);
        return embedding;
      },
    });

    expect(Number.isFinite(result.totalEstimatedCostUsd)).toBe(true);
    expect(result.totalEstimatedCostUsd).toBe(budget.totalEstimatedCostUsd);
    expect(result.totalEstimatedCostUsd).toBeLessThanOrEqual(costLimitUsd);
  });
});
