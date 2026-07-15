import { describe, expect, it } from "vitest";

import {
  claimSchema,
  evidenceLinkSchema,
  projectSchema,
  researchRunSchema,
  sourceChunkSchema,
  sourceSchema,
} from "@/features/research/domain";
import {
  canonicalizeUrl,
  chunkSourceText,
  createContentHash,
  extractDomain,
} from "@/features/sources/source-utils";

describe("research domain schemas", () => {
  it("validates the core research entities", () => {
    expect(
      projectSchema.parse({
        id: "project_demo",
        ownerId: "user_ailian",
        title: "Evidence Graph vs AI search",
        question: "How is Evidence Graph different from normal AI search summaries?",
        status: "active",
        visibility: "private",
        slug: "evidence-graph-vs-ai-search",
        createdAt: "2026-07-15T00:00:00.000Z",
        updatedAt: "2026-07-15T00:00:00.000Z",
      }).status,
    ).toBe("active");

    expect(
      researchRunSchema.parse({
        id: "run_demo",
        projectId: "project_demo",
        ownerId: "user_ailian",
        status: "queued",
        step: "queued",
        sourceLimit: 12,
        manualUrlLimit: 5,
        maxContentChars: 200000,
        estimatedCostUsd: 0,
        searchCount: 0,
        tokenCount: 0,
        createdAt: "2026-07-15T00:00:00.000Z",
        updatedAt: "2026-07-15T00:00:00.000Z",
      }).step,
    ).toBe("queued");

    expect(
      sourceSchema.parse({
        id: "source_demo",
        projectId: "project_demo",
        canonicalUrl: "https://example.com/research",
        title: "Research interview",
        domain: "example.com",
        sourceType: "primary_interview",
        body: "Exact quotes must be preserved for later review.",
        contentHash: "sha256_demo",
        retrievedAt: "2026-07-15T00:00:00.000Z",
      }).sourceType,
    ).toBe("primary_interview");

    expect(
      sourceChunkSchema.parse({
        id: "chunk_demo",
        sourceId: "source_demo",
        projectId: "project_demo",
        chunkIndex: 0,
        text: "Exact quotes must be preserved for later review.",
        startChar: 0,
        endChar: 48,
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
      }).embeddingDimensions,
    ).toBe(1536);

    expect(
      claimSchema.parse({
        id: "claim_demo",
        projectId: "project_demo",
        statement: "Evidence Graph stores exact source quotes.",
        normalizedKey: "evidence graph stores exact source quotes",
        claimType: "factual",
        qualifiers: ["MVP"],
        confidence: 0.82,
        reviewStatus: "pending",
        createdAt: "2026-07-15T00:00:00.000Z",
      }).reviewStatus,
    ).toBe("pending");

    expect(
      evidenceLinkSchema.parse({
        id: "link_demo",
        claimId: "claim_demo",
        chunkId: "chunk_demo",
        projectId: "project_demo",
        relation: "supports",
        strength: "strong",
        quote: "Exact quotes must be preserved",
        rationale: "The source states the persistence requirement directly.",
      }).relation,
    ).toBe("supports");
  });
});

describe("source utilities", () => {
  it("canonicalizes source URLs and hashes body text deterministically", () => {
    expect(canonicalizeUrl("HTTPS://Example.com/Research/?utm_source=x&b=2&a=1#top")).toBe(
      "https://example.com/Research/?a=1&b=2",
    );
    expect(extractDomain("https://Sub.Example.com/research")).toBe("sub.example.com");
    expect(createContentHash("  Evidence Graph keeps exact quotes.  ")).toBe(
      createContentHash("Evidence Graph keeps exact quotes."),
    );
  });

  it("chunks source text with stable character offsets", () => {
    const text = `${"A".repeat(900)}\n\n${"B".repeat(700)}`;
    const chunks = chunkSourceText({ sourceId: "source_demo", projectId: "project_demo", text });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ chunkIndex: 0, startChar: 0, endChar: 900 });
    expect(chunks[1].text).toBe("B".repeat(700));
    expect(chunks[1].embeddingModel).toBe("text-embedding-3-small");
  });
});
