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

export type FixtureResearchProviderOptions = {
  costOverrides?: Partial<Record<FixtureProviderCall["operation"], number>>;
  failOnceAt?: FixtureProviderCall["operation"];
  invalidQuote?: boolean;
  searchResultCount?: number;
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
        quote:
          "A cited report should use only claims with stored evidence links and preserved source excerpts",
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

const createSearchResults = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    if (index < SEARCH_RESULTS.length) {
      return SEARCH_RESULTS[index];
    }

    return {
      url: `https://sources.example.com/research-${index}`,
      title: `Additional research source ${index}`,
      body: `Additional deterministic research evidence ${index}.`,
      sourceType: "article" as const,
    };
  });

export const createFixtureResearchProviders = (
  options: FixtureResearchProviderOptions = {},
) => {
  const calls: FixtureProviderCall[] = [];
  const failedOperations = new Set<FixtureProviderCall["operation"]>();
  const failOnce = (operation: FixtureProviderCall["operation"]) => {
    if (options.failOnceAt === operation && !failedOperations.has(operation)) {
      failedOperations.add(operation);
      throw new Error("FIXTURE_PROVIDER_FAILED");
    }
  };
  const createStructuredOutput = (operation: ResearchModelOperation) => {
    const output = structuredClone(STRUCTURED_OUTPUTS[operation]);

    if (options.invalidQuote && operation === "link_evidence") {
      const evidenceOutput = output as { evidence: Array<{ quote: string }> };
      evidenceOutput.evidence[0].quote = "This quote is not present in the saved chunk";
    }

    return output;
  };
  const getCost = (operation: FixtureProviderCall["operation"], fallback: number) =>
    options.costOverrides?.[operation] ?? fallback;
  const search: SearchProvider = {
    search: async ({ maxResults, idempotencyKey }) => {
      calls.push({ operation: "search", idempotencyKey });
      failOnce("search");

      return {
        data: createSearchResults(options.searchResultCount ?? SEARCH_RESULTS.length).slice(
          0,
          maxResults,
        ),
        usage: {
          estimatedCostUsd: getCost("search", 0.01),
          searchCount: 1,
          tokenCount: 0,
        },
      };
    },
  };
  const languageModel: LanguageModel = {
    generateStructured: async ({ operation, schema, idempotencyKey }) => {
      calls.push({ operation, idempotencyKey });
      failOnce(operation);

      return {
        data: schema.parse(createStructuredOutput(operation)),
        usage: {
          estimatedCostUsd: getCost(operation, 0.01),
          searchCount: 0,
          tokenCount: 120,
        },
      };
    },
  };
  const embedding: EmbeddingProvider = {
    embed: async ({ texts, idempotencyKey }) => {
      calls.push({ operation: "embed", idempotencyKey });
      failOnce("embed");

      return {
        data: texts.map(() => Array<number>(1536).fill(0)),
        usage: {
          estimatedCostUsd: getCost("embed", 0.001),
          searchCount: 0,
          tokenCount: texts.reduce((total, text) => total + text.length, 0),
        },
      };
    },
  };

  return { search, languageModel, embedding, calls };
};
