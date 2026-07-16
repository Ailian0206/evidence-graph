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
import { createClaimKey, validateExactQuote } from "@/features/claims/claim-utils";
import { createDemoResearchFixture } from "@/features/research/fixtures";
import { createInMemoryProjectRepository } from "@/features/projects/project-repository";

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

  it.each([
    [1200, [1200]],
    [1201, [1201]],
    [1599, [1599]],
    [1600, [800, 800]],
    [2400, [1200, 1200]],
    [2401, [801, 800, 800]],
  ])("chunks a %i-character paragraph without a degenerate tail", (length, expectedSizes) => {
    const text = "A".repeat(length);
    const chunks = chunkSourceText({ sourceId: "source_long", projectId: "project_demo", text });

    expect(chunks.map((chunk) => chunk.text.length)).toEqual(expectedSizes);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(text);
    expect(chunks[0].startChar).toBe(0);
    expect(chunks.at(-1)?.endChar).toBe(length);
  });
});

describe("claim utilities", () => {
  it("normalizes claim keys without losing meaning", () => {
    expect(createClaimKey(" Evidence Graph stores exact source quotes! ")).toBe(
      "evidence graph stores exact source quotes",
    );
    expect(createClaimKey("C++ is memory-safe")).not.toBe(
      createClaimKey("C is memory-safe"),
    );
    expect(createClaimKey("C++ is memory-safe")).not.toBe(
      createClaimKey("C++ is memorysafe"),
    );
  });

  it("accepts only exact quotes from saved chunks", () => {
    const chunkText = "The saved source says exact quotes must be preserved for review.";

    expect(validateExactQuote({ chunkText, quote: "exact quotes must be preserved" })).toEqual({
      ok: true,
      startChar: 22,
      endChar: 52,
    });
    expect(validateExactQuote({ chunkText, quote: "exact quotes should be preserved" })).toEqual({
      ok: false,
      reason: "QUOTE_NOT_FOUND",
    });
    expect(validateExactQuote({ chunkText, quote: "" })).toEqual({
      ok: false,
      reason: "QUOTE_NOT_FOUND",
    });
    expect(validateExactQuote({ chunkText, quote: " " })).toEqual({
      ok: false,
      reason: "QUOTE_NOT_FOUND",
    });
  });
});

describe("research fixtures", () => {
  it("creates deterministic provider-free research fixtures", () => {
    const first = createDemoResearchFixture();
    const second = createDemoResearchFixture();

    expect(first).toEqual(second);
    expect(first.projects).toHaveLength(1);
    expect(first.sources).toHaveLength(2);
    expect(first.claims.map((claim) => claim.normalizedKey)).toContain(
      "evidence graph keeps claims connected to exact quotes",
    );
    expect(first.evidenceLinks.every((link) => link.quote.length > 0)).toBe(true);
  });
});

describe("project repository boundary", () => {
  it("rejects duplicate sources while initializing the repository", () => {
    const fixture = createDemoResearchFixture();
    fixture.sources.push({
      ...fixture.sources[0],
      id: "source_duplicate_url",
      contentHash: "sha256_duplicate_url",
    });

    expect(() => createInMemoryProjectRepository(fixture)).toThrow("SOURCE_ALREADY_EXISTS");
  });

  it("allows duplicate source content hashes across owner projects", () => {
    const fixture = createDemoResearchFixture();
    const otherProject = {
      ...fixture.projects[0],
      id: "project_other_owner",
      ownerId: "user_other",
      slug: "other-owner-project",
    };
    const otherSource = {
      ...fixture.sources[0],
      id: "source_other_owner",
      projectId: otherProject.id,
      canonicalUrl: "https://other.example.com/shared-research",
      domain: "other.example.com",
    };
    fixture.projects.push(otherProject);
    fixture.sources.push(otherSource);

    const repository = createInMemoryProjectRepository(fixture);

    expect(
      repository.listSources({ ownerId: otherProject.ownerId, projectId: otherProject.id }),
    ).toEqual([otherSource]);
  });

  it("rejects duplicate source content hashes within a project", () => {
    const fixture = createDemoResearchFixture();
    const repository = createInMemoryProjectRepository(fixture);
    const [source] = fixture.sources;

    expect(() =>
      repository.addSource({
        ownerId: fixture.projects[0].ownerId,
        source: {
          ...source,
          id: "source_same_project_duplicate_hash",
          canonicalUrl: "https://another.example.com/shared-research",
          domain: "another.example.com",
        },
      }),
    ).toThrow("SOURCE_ALREADY_EXISTS");
  });

  it("rejects duplicate claims and evidence links while initializing", () => {
    const claimFixture = createDemoResearchFixture();
    claimFixture.claims.push({
      ...claimFixture.claims[0],
      id: "claim_duplicate_normalized_key",
    });

    expect(() => createInMemoryProjectRepository(claimFixture)).toThrow(
      "CLAIM_ALREADY_EXISTS",
    );

    const evidenceFixture = createDemoResearchFixture();
    evidenceFixture.evidenceLinks.push({
      ...evidenceFixture.evidenceLinks[0],
      id: "link_duplicate_tuple",
    });

    expect(() => createInMemoryProjectRepository(evidenceFixture)).toThrow(
      "EVIDENCE_LINK_ALREADY_EXISTS",
    );
  });

  it("validates IDs and project ownership for all initialized records", () => {
    const projectFixture = createDemoResearchFixture();
    projectFixture.projects.push({
      ...projectFixture.projects[0],
      ownerId: "user_other",
    });
    expect(() => createInMemoryProjectRepository(projectFixture)).toThrow(
      "PROJECT_ALREADY_EXISTS",
    );

    const runFixture = createDemoResearchFixture();
    runFixture.researchRuns[0].ownerId = "user_other";
    expect(() => createInMemoryProjectRepository(runFixture)).toThrow("RUN_PROJECT_MISMATCH");

    const chunkFixture = createDemoResearchFixture();
    chunkFixture.chunks.push({
      ...chunkFixture.chunks[0],
      text: "Duplicate chunk ID",
    });
    expect(() => createInMemoryProjectRepository(chunkFixture)).toThrow(
      "CHUNK_ALREADY_EXISTS",
    );

    const relationFixture = createDemoResearchFixture();
    const otherProject = {
      ...relationFixture.projects[0],
      id: "project_relation_other",
      slug: "relation-other",
    };
    const otherClaim = {
      ...relationFixture.claims[0],
      id: "claim_relation_other",
      projectId: otherProject.id,
      normalizedKey: "other relation claim",
    };
    relationFixture.projects.push(otherProject);
    relationFixture.claims.push(otherClaim);
    relationFixture.claimRelations.push({
      id: "relation_cross_project",
      projectId: relationFixture.projects[0].id,
      fromClaimId: relationFixture.claims[0].id,
      toClaimId: otherClaim.id,
      relation: "depends_on",
      rationale: "Cross-project relations must be rejected.",
    });
    expect(() => createInMemoryProjectRepository(relationFixture)).toThrow(
      "CLAIM_RELATION_TARGET_NOT_FOUND",
    );
  });

  it("rejects chunks whose offsets do not match the saved source body", () => {
    const baseFixture = createDemoResearchFixture();
    const chunk = baseFixture.chunks[0];
    const invalidChunks = [
      { ...chunk, startChar: 10, endChar: 5 },
      {
        ...chunk,
        startChar: baseFixture.sources[0].body.length + 1,
        endChar: baseFixture.sources[0].body.length + 2,
        text: "X",
      },
      { ...chunk, endChar: chunk.endChar - 1 },
      { ...chunk, text: `X${chunk.text.slice(1)}` },
    ];

    for (const invalidChunk of invalidChunks) {
      const fixture = createDemoResearchFixture();
      fixture.chunks[0] = invalidChunk;

      expect(() => createInMemoryProjectRepository(fixture)).toThrow(
        "CHUNK_SOURCE_MISMATCH",
      );
    }
  });

  it("rejects self-referential claim relations", () => {
    const fixture = createDemoResearchFixture();
    const claimId = fixture.claims[0].id;
    fixture.claimRelations.push({
      id: "relation_self_reference",
      projectId: fixture.projects[0].id,
      fromClaimId: claimId,
      toClaimId: claimId,
      relation: "contradicts",
      rationale: "A claim cannot contradict itself.",
    });

    expect(() => createInMemoryProjectRepository(fixture)).toThrow(
      "CLAIM_RELATION_SELF_REFERENCE",
    );
  });

  it("rejects source ID overwrites and duplicate normalized claims", () => {
    const repository = createInMemoryProjectRepository(createDemoResearchFixture());
    const projectId = repository.listProjects("user_ailian")[0].id;
    const [source] = repository.listSources({ ownerId: "user_ailian", projectId });
    const [claim] = repository.listClaims({ ownerId: "user_ailian", projectId });

    expect(() =>
      repository.addSource({
        ownerId: "user_ailian",
        source: {
          ...source,
          canonicalUrl: "https://example.com/replaced",
          contentHash: "sha256_replaced",
        },
      }),
    ).toThrow("SOURCE_ALREADY_EXISTS");
    expect(() =>
      repository.addClaim({
        ownerId: "user_ailian",
        claim: { ...claim, id: "claim_duplicate_normalized_key" },
      }),
    ).toThrow("CLAIM_ALREADY_EXISTS");
  });

  it("rejects cross-owner project reads and writes", () => {
    const repository = createInMemoryProjectRepository(createDemoResearchFixture());
    const projectId = repository.listProjects("user_ailian")[0].id;
    const [source] = repository.listSources({ ownerId: "user_ailian", projectId });

    expect(repository.listSources({ ownerId: "user_other", projectId })).toEqual([]);
    expect(() =>
      repository.addSource({
        ownerId: "user_other",
        source: {
          ...source,
          id: "source_cross_owner",
          canonicalUrl: "https://attacker.example.com/source",
          contentHash: "sha256_cross_owner",
        },
      }),
    ).toThrow("PROJECT_NOT_FOUND");
  });

  it("does not expose mutable repository records", () => {
    const fixture = createDemoResearchFixture();
    const repository = createInMemoryProjectRepository(fixture);
    const project = repository.listProjects("user_ailian")[0];
    const [source] = repository.listSources({
      ownerId: "user_ailian",
      projectId: project.id,
    });
    const originalTitle = source.title;

    fixture.projects[0].ownerId = "user_other";
    project.ownerId = "user_other";
    source.title = "Mutated outside the repository";

    expect(repository.listProjects("user_ailian")).toHaveLength(1);
    expect(repository.listProjects("user_other")).toHaveLength(0);
    expect(
      repository.listSources({ ownerId: "user_ailian", projectId: project.id })[0].title,
    ).toBe(originalTitle);
  });

  it("rejects evidence links with missing or cross-project targets", () => {
    const fixture = createDemoResearchFixture();
    const otherProject = {
      ...fixture.projects[0],
      id: "project_other",
      slug: "other-project",
    };
    const otherSource = {
      ...fixture.sources[0],
      id: "source_other",
      projectId: otherProject.id,
      canonicalUrl: "https://other.example.com/research",
      contentHash: "sha256_other",
    };
    const otherChunk = {
      ...fixture.chunks[0],
      id: "source_other_chunk_0",
      sourceId: otherSource.id,
      projectId: otherProject.id,
    };
    fixture.projects.push(otherProject);
    fixture.sources.push(otherSource);
    fixture.chunks.push(otherChunk);

    const repository = createInMemoryProjectRepository(fixture);
    const projectId = fixture.projects[0].id;
    const claimId = fixture.claims[0].id;
    const [ownChunk] = repository.listChunks({
      ownerId: "user_ailian",
      projectId,
      sourceId: fixture.sources[0].id,
    });

    expect(() =>
      repository.addEvidenceLink({
        ownerId: "user_ailian",
        link: {
          id: "link_cross_project",
          projectId,
          claimId,
          chunkId: otherChunk.id,
          relation: "supports",
          strength: "strong",
          quote: otherChunk.text,
          rationale: "Cross-project evidence must be rejected.",
        },
      }),
    ).toThrow("EVIDENCE_TARGET_NOT_FOUND");
    expect(() =>
      repository.addEvidenceLink({
        ownerId: "user_ailian",
        link: {
          id: "link_missing_claim",
          projectId,
          claimId: "claim_missing",
          chunkId: ownChunk.id,
          relation: "context",
          strength: "moderate",
          quote: ownChunk.text,
          rationale: "Missing claims must be rejected.",
        },
      }),
    ).toThrow("EVIDENCE_TARGET_NOT_FOUND");
  });

  it("enforces owner isolation and project cascade deletion", () => {
    const fixture = createDemoResearchFixture();
    const secondClaim = {
      ...fixture.claims[0],
      id: "claim_cited_reports",
      statement: "Cited reports require stored evidence links.",
      normalizedKey: "cited reports require stored evidence links",
    };
    fixture.claims.push(secondClaim);
    fixture.claimRelations.push({
      id: "relation_exact_quotes_reports",
      projectId: fixture.projects[0].id,
      fromClaimId: fixture.claims[0].id,
      toClaimId: secondClaim.id,
      relation: "depends_on",
      rationale: "Cited reports depend on exact-quote evidence.",
    });
    const repository = createInMemoryProjectRepository(fixture);

    expect(repository.listProjects("user_ailian")).toHaveLength(1);
    expect(repository.listProjects("user_other")).toHaveLength(0);

    const projectId = repository.listProjects("user_ailian")[0].id;
    expect(repository.listResearchRuns({ ownerId: "user_ailian", projectId })).toHaveLength(1);
    expect(repository.listClaimRelations({ ownerId: "user_ailian", projectId })).toHaveLength(1);
    repository.deleteProject({ ownerId: "user_ailian", projectId });

    expect(repository.listProjects("user_ailian")).toHaveLength(0);
    expect(repository.listSources({ ownerId: "user_ailian", projectId })).toHaveLength(0);
    expect(repository.listClaims({ ownerId: "user_ailian", projectId })).toHaveLength(0);
    expect(repository.listResearchRuns({ ownerId: "user_ailian", projectId })).toHaveLength(0);
    expect(repository.listClaimRelations({ ownerId: "user_ailian", projectId })).toHaveLength(0);
  });

  it("rejects duplicate sources and non-exact evidence quotes", () => {
    const repository = createInMemoryProjectRepository(createDemoResearchFixture());
    const projectId = repository.listProjects("user_ailian")[0].id;
    const [source] = repository.listSources({ ownerId: "user_ailian", projectId });
    const [claim] = repository.listClaims({ ownerId: "user_ailian", projectId });
    const [chunk] = repository.listChunks({
      ownerId: "user_ailian",
      projectId,
      sourceId: source.id,
    });

    expect(() => repository.addSource({ ownerId: "user_ailian", source })).toThrow(
      "SOURCE_ALREADY_EXISTS",
    );
    expect(() =>
      repository.addEvidenceLink({
        ownerId: "user_ailian",
        link: {
          id: "link_bad_quote",
          projectId,
          claimId: claim.id,
          chunkId: chunk.id,
          relation: "supports",
          strength: "strong",
          quote: "not present in the chunk",
          rationale: "This should fail.",
        },
      }),
    ).toThrow("QUOTE_NOT_FOUND");
  });
});
