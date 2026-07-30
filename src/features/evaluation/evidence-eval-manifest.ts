export const EVIDENCE_EVAL_MANIFEST_VERSION = "c4-v1" as const;

export const evidenceEvalCategories = [
  "technical",
  "competition",
  "market",
] as const;

export type EvidenceEvalCategory = (typeof evidenceEvalCategories)[number];

export type EvidenceEvalManifestItem = {
  id: string;
  category: EvidenceEvalCategory;
  language: "en" | "zh";
  question: string;
};

export const evidenceEvalManifest = [
  {
    id: "technical-vector-store",
    category: "technical",
    language: "en",
    question:
      "For a small production AI research application, when is PostgreSQL with pgvector preferable to a dedicated vector database?",
  },
  {
    id: "technical-durable-workflow",
    category: "technical",
    language: "en",
    question:
      "For durable multi-step research, what reliability trade-offs distinguish Inngest from synchronous server execution?",
  },
  {
    id: "technical-citation-verifiability",
    category: "technical",
    language: "en",
    question:
      "How do exact quote storage and source chunk boundaries affect citation verifiability in retrieval-augmented generation systems?",
  },
  {
    id: "technical-nextjs-mutations",
    category: "technical",
    language: "en",
    question:
      "For authenticated Next.js mutations, what trade-offs distinguish Server Actions from Route Handlers?",
  },
  {
    id: "competition-traceability",
    category: "competition",
    language: "en",
    question:
      "How do Perplexity, Elicit, and Consensus differ in source traceability and claim-level verification?",
  },
  {
    id: "competition-evidence-relations",
    category: "competition",
    language: "en",
    question:
      "How do AI research assistants surface supporting, qualifying, and contradictory evidence?",
  },
  {
    id: "competition-review-controls",
    category: "competition",
    language: "en",
    question:
      "Which review controls distinguish evidence-first research workspaces from general AI search summaries?",
  },
  {
    id: "market-ai-adoption",
    category: "market",
    language: "en",
    question:
      "What published evidence since 2024 measures generative AI adoption in knowledge work?",
  },
  {
    id: "market-provider-pricing",
    category: "market",
    language: "en",
    question:
      "What current public pricing and usage limits matter when combining web search, language models, and embeddings for an MVP?",
  },
  {
    id: "market-ai-traceability-policy",
    category: "market",
    language: "en",
    question:
      "Which EU and US requirements or guidance since 2024 affect disclosure and traceability of AI-assisted research outputs?",
  },
] as const satisfies readonly EvidenceEvalManifestItem[];
