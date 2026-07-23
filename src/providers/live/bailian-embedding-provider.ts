import "server-only";

import { z } from "zod";

import { currentEmbeddingModel } from "@/features/research/domain";
import type { EmbeddingProvider } from "@/providers/contracts";
import {
  providerHeaders,
  requestProviderJson,
  type ProviderFetch,
} from "@/providers/live/provider-http";

// Beijing list price is 0.5 CNY/1M tokens; this USD ceiling avoids FX underestimation.
const BAILIAN_INPUT_COST_USD_PER_MILLION = 0.1;
const BATCH_SIZE = 10;
const defaultProviderFetch: ProviderFetch = (input, init) => fetch(input, init);

const bailianResponseSchema = z.object({
  data: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      embedding: z.array(z.number()).length(1536),
    }),
  ),
  usage: z.object({ total_tokens: z.number().int().nonnegative() }),
});

export const createBailianEmbeddingProvider = ({
  apiKey,
  workspaceId,
  fetchImpl = defaultProviderFetch,
}: {
  apiKey: string;
  workspaceId: string;
  fetchImpl?: ProviderFetch;
}): EmbeddingProvider => ({
  embed: async ({ texts }) => {
    const vectors: number[][] = [];
    let totalTokens = 0;

    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const batch = texts.slice(start, start + BATCH_SIZE);
      const responseBody = await requestProviderJson({
        fetchImpl,
        input: `https://${workspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/embeddings`,
        init: {
          method: "POST",
          headers: providerHeaders(apiKey),
          body: JSON.stringify({
            model: currentEmbeddingModel,
            input: batch,
            dimensions: 1536,
            encoding_format: "float",
          }),
        },
        errorCode: "BAILIAN_REQUEST_FAILED",
      });
      let parsed: z.infer<typeof bailianResponseSchema>;
      try {
        parsed = bailianResponseSchema.parse(responseBody);
      } catch {
        throw new Error("PROVIDER_RESPONSE_INVALID");
      }
      totalTokens += parsed.usage.total_tokens;
      const orderedData = [...parsed.data].sort(
        (left, right) => left.index - right.index,
      );

      if (
        orderedData.length !== batch.length ||
        orderedData.some((item, index) => item.index !== index)
      ) {
        throw new Error("PROVIDER_RESPONSE_INVALID");
      }

      vectors.push(...orderedData.map((item) => item.embedding));
    }

    return {
      data: vectors,
      usage: {
        estimatedCostUsd: (totalTokens * BAILIAN_INPUT_COST_USD_PER_MILLION) / 1_000_000,
        searchCount: 0,
        tokenCount: totalTokens,
      },
    };
  },
});
