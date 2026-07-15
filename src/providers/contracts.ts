import { z } from "zod";

import { sourceTypeSchema } from "@/features/research/domain";

export const searchResultSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceType: sourceTypeSchema,
  author: z.string().min(1).optional(),
  publishedAt: z.string().datetime().optional(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const providerUsageSchema = z.object({
  estimatedCostUsd: z.number().nonnegative(),
  searchCount: z.number().int().nonnegative(),
  tokenCount: z.number().int().nonnegative(),
});

export type ProviderUsage = z.infer<typeof providerUsageSchema>;

export type ProviderResult<T> = {
  data: T;
  usage: ProviderUsage;
};

export type SearchProvider = {
  search: (input: {
    query: string;
    maxResults: number;
    idempotencyKey: string;
  }) => Promise<ProviderResult<SearchResult[]>>;
};

export type ResearchModelOperation =
  | "plan"
  | "extract_claims"
  | "link_evidence"
  | "detect_conflicts"
  | "draft_report";

export type LanguageModel = {
  generateStructured: <T>(input: {
    operation: ResearchModelOperation;
    schema: z.ZodType<T>;
    payload: unknown;
    idempotencyKey: string;
  }) => Promise<ProviderResult<T>>;
};

export type EmbeddingProvider = {
  embed: (input: {
    texts: string[];
    idempotencyKey: string;
  }) => Promise<ProviderResult<number[][]>>;
};
