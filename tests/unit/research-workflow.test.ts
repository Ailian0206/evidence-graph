import { describe, expect, it } from "vitest";
import { z } from "zod";

import { searchResultSchema } from "@/providers/contracts";
import { createFixtureResearchProviders } from "@/providers/fixtures/research-providers";

describe("research provider fixtures", () => {
  it("returns deterministic structured data and records idempotency keys", async () => {
    const first = createFixtureResearchProviders();
    const second = createFixtureResearchProviders();

    const firstSearch = await first.search.search({
      query: "traceable AI research",
      maxResults: 12,
      idempotencyKey: "run_demo:searching:0",
    });
    const secondSearch = await second.search.search({
      query: "traceable AI research",
      maxResults: 12,
      idempotencyKey: "run_demo:searching:0",
    });

    expect(firstSearch).toEqual(secondSearch);
    expect(searchResultSchema.array().parse(firstSearch.data)).toHaveLength(2);
    expect(first.calls).toEqual([
      expect.objectContaining({
        operation: "search",
        idempotencyKey: "run_demo:searching:0",
      }),
    ]);
  });

  it("validates structured model output and returns stable embeddings", async () => {
    const providers = createFixtureResearchProviders();
    const planSchema = z.object({
      queries: z.array(z.string().min(1)).min(3).max(5),
    });

    const plan = await providers.languageModel.generateStructured({
      operation: "plan",
      schema: planSchema,
      payload: { question: "How does traceable research work?" },
      idempotencyKey: "run_demo:planning",
    });
    const embeddings = await providers.embedding.embed({
      texts: ["Exact quotes remain inspectable."],
      idempotencyKey: "run_demo:indexing",
    });

    expect(plan.data.queries).toHaveLength(3);
    expect(embeddings.data).toHaveLength(1);
    expect(embeddings.data[0]).toHaveLength(1536);
    expect(providers.calls.map((call) => call.operation)).toEqual(["plan", "embed"]);
  });
});
