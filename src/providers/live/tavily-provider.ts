import "server-only";

import { z } from "zod";

import { searchResultSchema, type SearchProvider } from "@/providers/contracts";
import {
  providerHeaders,
  requestProviderJson,
  type ProviderFetch,
} from "@/providers/live/provider-http";

const TAVILY_SEARCH_ENDPOINT = "https://api.tavily.com/search";
const TAVILY_EXTRACT_ENDPOINT = "https://api.tavily.com/extract";
const TAVILY_CREDIT_USD = 0.008;
const defaultProviderFetch: ProviderFetch = (input, init) => fetch(input, init);
const tavilyPublishedDateSchema = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true }),
]);

const tavilySearchResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string().url(),
      title: z.string().min(1),
      content: z.string().optional(),
      raw_content: z.string().nullable().optional(),
      published_date: z.string().nullable().optional(),
    }),
  ),
  usage: z.object({ credits: z.number().nonnegative().optional() }).optional(),
});

const tavilyExtractResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string().url(),
      title: z.string().min(1).optional(),
      raw_content: z.string().nullable().optional(),
      content: z.string().optional(),
    }),
  ),
  usage: z.object({ credits: z.number().nonnegative().optional() }).optional(),
});

const mapResult = (result: {
  url: string;
  title?: string;
  content?: string;
  raw_content?: string | null;
  published_date?: string | null;
}) => {
  const body = result.raw_content?.trim() || result.content?.trim();

  if (!body) {
    return null;
  }

  const parsedPublishedDate = tavilyPublishedDateSchema.safeParse(result.published_date);
  const publishedAt = parsedPublishedDate.success
    ? new Date(parsedPublishedDate.data).toISOString()
    : undefined;

  return searchResultSchema.parse({
    url: result.url,
    title: result.title?.trim() || result.url,
    body,
    sourceType: "article",
    ...(publishedAt ? { publishedAt } : {}),
  });
};

const parseTavilyResponse = <T>(
  schema: z.ZodType<T>,
  input: unknown,
): T => {
  try {
    return schema.parse(input);
  } catch {
    throw new Error("PROVIDER_RESPONSE_INVALID");
  }
};

const getCredits = (credits: number | undefined, fallback: number) =>
  credits === undefined || credits <= 0 ? fallback : credits;

export const createTavilySearchProvider = ({
  apiKey,
  fetchImpl = defaultProviderFetch,
}: {
  apiKey: string;
  fetchImpl?: ProviderFetch;
}): SearchProvider => ({
  search: async ({ query, maxResults }) => {
    if (maxResults < 1 || maxResults > 12) {
      throw new Error("SOURCE_LIMIT_EXCEEDED");
    }

    const parsed = parseTavilyResponse(
      tavilySearchResponseSchema,
      await requestProviderJson({
        fetchImpl,
        input: TAVILY_SEARCH_ENDPOINT,
        init: {
          method: "POST",
          headers: providerHeaders(apiKey),
          body: JSON.stringify({
            query,
            search_depth: "basic",
            max_results: maxResults,
            include_raw_content: true,
            include_answer: false,
            include_images: false,
            include_usage: true,
          }),
        },
        errorCode: "TAVILY_REQUEST_FAILED",
      }),
    );
    const data = parsed.results
      .map(mapResult)
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .slice(0, maxResults);

    return {
      data,
      usage: {
        estimatedCostUsd: getCredits(parsed.usage?.credits, 1) * TAVILY_CREDIT_USD,
        searchCount: 1,
        tokenCount: 0,
      },
    };
  },
  extract: async ({ urls }) => {
    if (urls.length > 5) {
      throw new Error("MANUAL_URL_LIMIT_EXCEEDED");
    }

    if (urls.length === 0) {
      return {
        data: [],
        usage: { estimatedCostUsd: 0, searchCount: 0, tokenCount: 0 },
      };
    }

    const parsed = parseTavilyResponse(
      tavilyExtractResponseSchema,
      await requestProviderJson({
        fetchImpl,
        input: TAVILY_EXTRACT_ENDPOINT,
        init: {
          method: "POST",
          headers: providerHeaders(apiKey),
          body: JSON.stringify({
            urls,
            extract_depth: "basic",
            format: "markdown",
            include_usage: true,
          }),
        },
        errorCode: "TAVILY_REQUEST_FAILED",
      }),
    );
    const data = parsed.results.map(mapResult).filter((value): value is NonNullable<typeof value> => value !== null);

    return {
      data,
      usage: {
        estimatedCostUsd:
          getCredits(parsed.usage?.credits, data.length > 0 ? 1 : 0) * TAVILY_CREDIT_USD,
        searchCount: 0,
        tokenCount: 0,
      },
    };
  },
});
