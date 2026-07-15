import type {
  EmbeddingProvider,
  LanguageModel,
  ResearchModelOperation,
  SearchProvider,
} from "@/providers/contracts";

export type FixtureProviderCall = {
  operation: "search" | "embed" | ResearchModelOperation;
  idempotencyKey: string;
};

const SEARCH_RESULTS = [
  {
    url: "https://example.com/research",
    title: "Product research interview",
    body: "Evidence Graph keeps claims connected to exact quotes for review.",
    sourceType: "primary_interview" as const,
    author: "Research participant",
    publishedAt: "2026-07-14T00:00:00.000Z",
  },
  {
    url: "https://docs.example.com/evidence-graph",
    title: "Evidence Graph product notes",
    body: "Cited reports use claims with persisted evidence links.",
    sourceType: "official_document" as const,
    publishedAt: "2026-07-15T00:00:00.000Z",
  },
];

const STRUCTURED_OUTPUTS: Partial<Record<ResearchModelOperation, unknown>> = {
  plan: {
    queries: [
      "traceable AI research",
      "exact quote evidence review",
      "cited research workflow",
    ],
  },
};

export const createFixtureResearchProviders = () => {
  const calls: FixtureProviderCall[] = [];
  const search: SearchProvider = {
    search: async ({ maxResults, idempotencyKey }) => {
      calls.push({ operation: "search", idempotencyKey });

      return {
        data: SEARCH_RESULTS.slice(0, maxResults),
        usage: {
          estimatedCostUsd: 0.01,
          searchCount: 1,
          tokenCount: 0,
        },
      };
    },
  };
  const languageModel: LanguageModel = {
    generateStructured: async ({ operation, schema, idempotencyKey }) => {
      calls.push({ operation, idempotencyKey });

      return {
        data: schema.parse(STRUCTURED_OUTPUTS[operation]),
        usage: {
          estimatedCostUsd: 0.01,
          searchCount: 0,
          tokenCount: 120,
        },
      };
    },
  };
  const embedding: EmbeddingProvider = {
    embed: async ({ texts, idempotencyKey }) => {
      calls.push({ operation: "embed", idempotencyKey });

      return {
        data: texts.map(() => Array<number>(1536).fill(0)),
        usage: {
          estimatedCostUsd: 0.001,
          searchCount: 0,
          tokenCount: texts.reduce((total, text) => total + text.length, 0),
        },
      };
    },
  };

  return { search, languageModel, embedding, calls };
};
