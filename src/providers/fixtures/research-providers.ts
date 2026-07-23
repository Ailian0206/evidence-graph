import type {
  EmbeddingProvider,
  LanguageModel,
  ResearchModelOperation,
  SearchProvider,
} from "@/providers/contracts";

export type FixtureProviderCall = {
  operation: "search" | "extract" | "embed" | ResearchModelOperation;
  idempotencyKey: string;
  payload?: unknown;
};

export type FixtureResearchProviderOptions = {
  additionalSupportingEvidence?: boolean;
  combinedReportParagraphs?: boolean;
  costOverrides?: Partial<Record<FixtureProviderCall["operation"], number>>;
  duplicateClaimCandidateId?: boolean;
  evidenceCount?: number;
  failOnceAt?: FixtureProviderCall["operation"];
  failSearchAtCall?: number;
  invalidQuote?: boolean;
  mixedUnsupportedReportClaim?: boolean;
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
    body: "A cited report should use only claims with stored evidence links and preserved source excerpts.",
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
        paragraphs: [
          {
            markdown: "Evidence Graph keeps claims connected to exact quotes.",
            claimIds: ["claim_exact_quotes"],
          },
        ],
      },
      {
        id: "section_counterevidence",
        heading: "Counterevidence",
        factual: true,
        paragraphs: [
          {
            markdown: "Persisted links prevent source excerpts from being omitted.",
            claimIds: ["claim_links_unnecessary"],
          },
        ],
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
  let searchCallCount = 0;
  let searchCallFailureUsed = false;
  const failOnce = (operation: FixtureProviderCall["operation"]) => {
    if (options.failOnceAt === operation && !failedOperations.has(operation)) {
      failedOperations.add(operation);
      throw new Error("FIXTURE_PROVIDER_FAILED");
    }
  };
  const createStructuredOutput = (operation: ResearchModelOperation, payload: unknown) => {
    const output = structuredClone(STRUCTURED_OUTPUTS[operation]);

    if (options.invalidQuote && operation === "link_evidence") {
      const evidenceOutput = output as { evidence: Array<{ quote: string }> };
      evidenceOutput.evidence[0].quote = "This quote is not present in the saved chunk";
    }

    if (options.duplicateClaimCandidateId && operation === "extract_claims") {
      const claimsOutput = output as { claims: Array<{ candidateId: string }> };
      claimsOutput.claims[1].candidateId = claimsOutput.claims[0].candidateId;
    }

    if (options.additionalSupportingEvidence && operation === "link_evidence") {
      const evidenceOutput = output as { evidence: unknown[] };
      evidenceOutput.evidence.push({
        claimCandidateId: "claim_exact_quotes",
        sourceUrl: "https://docs.example.com/evidence-graph",
        quote:
          "A cited report should use only claims with stored evidence links and preserved source excerpts",
        relation: "supports",
        strength: "moderate",
        rationale: "The product notes provide a second exact excerpt for the claim.",
      });
    }

    if (options.evidenceCount !== undefined && operation === "link_evidence") {
      const evidenceOutput = output as { evidence: unknown[] };
      evidenceOutput.evidence = evidenceOutput.evidence.slice(0, options.evidenceCount);
    }

    if (operation === "draft_report") {
      const allowedClaimIds = new Set(
        ((payload as { claims?: Array<{ candidateId: string }> }).claims ?? []).map(
          (claim) => claim.candidateId,
        ),
      );
      const reportOutput = output as {
        sections: Array<{ paragraphs: Array<{ claimIds: string[] }> }>;
      };
      reportOutput.sections = reportOutput.sections.filter((section) =>
        section.paragraphs.some((paragraph) =>
          paragraph.claimIds.every((claimId) => allowedClaimIds.has(claimId)),
        ),
      );
    }

    if (options.mixedUnsupportedReportClaim && operation === "draft_report") {
      const reportOutput = output as {
        sections: Array<{ paragraphs: Array<{ claimIds: string[] }> }>;
      };
      reportOutput.sections[0].paragraphs[0].claimIds.push("claim_links_unnecessary");
    }

    if (options.combinedReportParagraphs && operation === "draft_report") {
      const reportOutput = output as {
        sections: Array<{
          id: string;
          heading: string;
          factual: boolean;
          paragraphs: Array<{ markdown: string; claimIds: string[] }>;
        }>;
      };
      reportOutput.sections = [
        {
          id: "section_combined",
          heading: "Evidence findings",
          factual: true,
          paragraphs: reportOutput.sections.flatMap((section) => section.paragraphs),
        },
      ];
    }

    return output;
  };
  const getCost = (operation: FixtureProviderCall["operation"], fallback: number) =>
    options.costOverrides?.[operation] ?? fallback;
  const search: SearchProvider = {
    search: async ({ maxResults, idempotencyKey }) => {
      calls.push({ operation: "search", idempotencyKey });
      searchCallCount += 1;

      if (options.failSearchAtCall === searchCallCount && !searchCallFailureUsed) {
        searchCallFailureUsed = true;
        throw new Error("FIXTURE_PROVIDER_FAILED");
      }

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
    extract: async ({ urls, idempotencyKey }) => {
      calls.push({ operation: "extract", idempotencyKey, payload: { urls } });
      failOnce("extract");

      return {
        data: urls.map((url, index) => ({
          url,
          title: `Manual source ${index + 1}`,
          body: `Manual source content ${index + 1} from ${url}.`,
          sourceType: "article" as const,
        })),
        usage: {
          estimatedCostUsd: getCost("extract", 0.01),
          searchCount: 0,
          tokenCount: urls.reduce((total, url) => total + url.length, 0),
        },
      };
    },
  };
  const languageModel: LanguageModel = {
    generateStructured: async ({ operation, schema, payload, idempotencyKey }) => {
      calls.push({ operation, idempotencyKey, payload });
      failOnce(operation);

      return {
        data: schema.parse(createStructuredOutput(operation, payload)),
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
