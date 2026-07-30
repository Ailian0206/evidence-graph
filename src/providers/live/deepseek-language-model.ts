import "server-only";

import { z } from "zod";

import type {
  LanguageModel,
  ResearchModelOperation,
} from "@/providers/contracts";
import { ProviderCallError } from "@/providers/contracts";
import {
  providerHeaders,
  requestProviderJson,
  type ProviderFetch,
} from "@/providers/live/provider-http";
import { modelSystemPrompt } from "@/providers/live/model-prompts";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const defaultProviderFetch: ProviderFetch = (input, init) => fetch(input, init);
// Official V4 Flash cache-miss pricing is used for the input estimate.
const DEEPSEEK_INPUT_COST_USD_PER_MILLION = 0.14;
const DEEPSEEK_OUTPUT_COST_USD_PER_MILLION = 0.28;

const deepSeekResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  }),
});

const createJsonSchema = (schema: z.ZodType<unknown>) => z.toJSONSchema(schema);

const estimateCost = (usage: z.infer<typeof deepSeekResponseSchema>["usage"]) =>
  (usage.prompt_tokens * DEEPSEEK_INPUT_COST_USD_PER_MILLION +
    usage.completion_tokens * DEEPSEEK_OUTPUT_COST_USD_PER_MILLION) /
  1_000_000;

export const createDeepSeekLanguageModel = ({
  apiKey,
  fetchImpl = defaultProviderFetch,
}: {
  apiKey: string;
  fetchImpl?: ProviderFetch;
}): LanguageModel => ({
  generateStructured: async <T>({ operation, schema, payload }: {
    operation: ResearchModelOperation;
    schema: z.ZodType<T>;
    payload: unknown;
    idempotencyKey: string;
  }): Promise<{
    data: T;
    usage: {
      estimatedCostUsd: number;
      searchCount: number;
      tokenCount: number;
    };
  }> => {
    let estimatedCostUsd = 0;
    let tokenCount = 0;
    let previousResponseErrors: Array<{ code: string; path: string }> | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const responseBody = await requestProviderJson({
        fetchImpl,
        input: DEEPSEEK_ENDPOINT,
        init: {
          method: "POST",
          headers: providerHeaders(apiKey),
          body: JSON.stringify({
            model: "deepseek-v4-flash",
            thinking: { type: "disabled" },
            temperature: 0,
            max_tokens: 4000,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: modelSystemPrompt(operation) },
              {
                role: "user",
                content: JSON.stringify({
                  output_schema: createJsonSchema(schema),
                  payload,
                  ...(previousResponseErrors
                    ? { previous_response_errors: previousResponseErrors }
                    : {}),
                }),
              },
            ],
          }),
        },
        errorCode: "DEEPSEEK_REQUEST_FAILED",
      });
      let parsedResponse: z.infer<typeof deepSeekResponseSchema>;
      try {
        parsedResponse = deepSeekResponseSchema.parse(responseBody);
      } catch {
        throw new Error("PROVIDER_RESPONSE_INVALID");
      }

      estimatedCostUsd += estimateCost(parsedResponse.usage);
      tokenCount += parsedResponse.usage.total_tokens;

      let decoded: unknown;
      try {
        decoded = JSON.parse(parsedResponse.choices[0].message.content);
      } catch {
        previousResponseErrors = [{ code: "invalid_json", path: "" }];
        continue;
      }

      const parsedData = schema.safeParse(decoded);
      if (parsedData.success) {
        return {
          data: parsedData.data,
          usage: { estimatedCostUsd, searchCount: 0, tokenCount },
        };
      }

      previousResponseErrors = parsedData.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.map(String).join("."),
      }));
    }

    throw new ProviderCallError("PROVIDER_RESPONSE_INVALID", {
      estimatedCostUsd,
      searchCount: 0,
      tokenCount,
    });
  },
});
