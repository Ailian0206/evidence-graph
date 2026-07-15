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
    body: "Ordinary AI summaries can omit saved source excerpts unless evidence links are persisted.",
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
  extract_claims: {
    claims: [
      {
        candidateId: "claim_exact_quotes",
        statement: "Evidence Graph keeps claims connected to exact quotes.",
        claimType: "factual",
        qualifiers: ["MVP"],
        confidence: 0.86,
      },
      {
        candidateId: "claim_links_unnecessary",
        statement: "Persisted evidence links are unnecessary for cited reports.",
        claimType: "factual",
        qualifiers: [],
        confidence: 0.22,
      },
    ],
  },
  link_evidence: {
    evidence: [
      {
        claimCandidateId: "claim_exact_quotes",
        sourceUrl: "https://example.com/research",
        quote: "Evidence Graph keeps claims connected to exact quotes",
        relation: "supports",
        strength: "strong",
        rationale: "The interview states the exact-quote behavior directly.",
      },
      {
        claimCandidateId: "claim_links_unnecessary",
        sourceUrl: "https://docs.example.com/evidence-graph",
        quote: "Ordinary AI summaries can omit saved source excerpts unless evidence links are persisted",
        relation: "rebuts",
        strength: "strong",
        rationale: "The product notes state why persisted evidence links are required.",
      },
    ],
  },
  detect_conflicts: {
    relations: [
      {
        fromClaimCandidateId: "claim_exact_quotes",
        toClaimCandidateId: "claim_links_unnecessary",
        relation: "contradicts",
        rationale: "Traceable exact quotes require persisted evidence links.",
      },
    ],
  },
  draft_report: {
    sections: [
      {
        id: "section_traceability",
        heading: "Traceability",
        factual: true,
        markdown: "Evidence Graph keeps claims connected to exact quotes.",
        claimIds: ["claim_exact_quotes"],
      },
      {
        id: "section_counterevidence",
        heading: "Counterevidence",
        factual: true,
        markdown: "Persisted links prevent source excerpts from being omitted.",
        claimIds: ["claim_links_unnecessary"],
      },
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
