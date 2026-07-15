# Research Domain Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the provider-free research domain foundation: typed Project, Research Run, Source, Chunk, Claim, Evidence Link, Relation, deterministic fixtures, and an in-memory persistence boundary that can later be replaced by Supabase.

**Architecture:** Keep the module pure TypeScript under focused feature folders. Zod schemas validate all domain inputs and fixtures. Deterministic utilities cover URL canonicalization, content hashing, chunking, normalized claim keys, exact quote validation, ownership checks, and cascade delete behavior without network, database, OpenAI, or Tavily calls.

**Tech Stack:** TypeScript, Zod 4, Vitest, Node `crypto`, existing Next.js/Vitest tooling.

---

## File map

- Create `src/features/research/domain.ts` for shared enums, branded IDs, entity schemas, and inferred types.
- Create `src/features/sources/source-utils.ts` for URL canonicalization, domain extraction, content hashing, and text chunking.
- Create `src/features/claims/claim-utils.ts` for claim normalization and exact quote validation.
- Create `src/features/projects/project-repository.ts` for an in-memory repository that enforces owner isolation, uniqueness, and cascade deletion.
- Create `src/features/research/fixtures.ts` for deterministic fixture builders used by tests and later mock workflows.
- Create `tests/unit/research-domain.test.ts` for schemas, utilities, fixtures, and repository behavior.
- Modify `PROJECT_STATUS.md` and `docs/development-plan.md` only when the module state changes.

## Task 1: Add domain schemas and types

**Files:**
- Create: `src/features/research/domain.ts`
- Create: `tests/unit/research-domain.test.ts`

- [x] Write the failing schema test.

```ts
import { describe, expect, it } from "vitest";

import {
  claimSchema,
  evidenceLinkSchema,
  projectSchema,
  researchRunSchema,
  sourceChunkSchema,
  sourceSchema,
} from "@/features/research/domain";

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
```

- [x] Run the test and verify RED.

```bash
npm run test:unit -- tests/unit/research-domain.test.ts --reporter=dot
```

Expected: FAIL because `@/features/research/domain` does not exist.

- [x] Implement the minimum schemas.

```ts
import { z } from "zod";

const isoDateSchema = z.string().datetime();
const idSchema = z.string().min(1);

export const projectStatusSchema = z.enum(["active", "archived", "deleted"]);
export const projectVisibilitySchema = z.enum(["private", "public"]);
export const runStepSchema = z.enum([
  "queued",
  "planning",
  "searching",
  "collecting",
  "indexing",
  "extracting_claims",
  "linking_evidence",
  "detecting_conflicts",
  "drafting_report",
  "ready",
  "failed",
  "cancelled",
]);
export const runStatusSchema = z.enum(["queued", "running", "ready", "failed", "cancelled"]);
export const sourceTypeSchema = z.enum([
  "primary_interview",
  "official_document",
  "article",
  "documentation",
  "dataset",
  "other",
]);
export const claimTypeSchema = z.enum(["factual", "causal", "comparative", "definition"]);
export const claimReviewStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export const evidenceRelationSchema = z.enum(["supports", "rebuts", "qualifies", "context"]);
export const evidenceStrengthSchema = z.enum(["weak", "moderate", "strong"]);
export const claimRelationTypeSchema = z.enum(["contradicts", "duplicates", "depends_on"]);

export const projectSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  title: z.string().min(1),
  question: z.string().min(1),
  status: projectStatusSchema,
  visibility: projectVisibilitySchema,
  slug: z.string().min(1),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const researchRunSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  ownerId: idSchema,
  status: runStatusSchema,
  step: runStepSchema,
  sourceLimit: z.number().int().min(1).max(12),
  manualUrlLimit: z.number().int().min(0).max(5),
  maxContentChars: z.number().int().positive().max(200000),
  estimatedCostUsd: z.number().min(0).max(1),
  searchCount: z.number().int().min(0),
  tokenCount: z.number().int().min(0),
  errorMessage: z.string().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const sourceSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  canonicalUrl: z.string().url(),
  title: z.string().min(1),
  author: z.string().optional(),
  publishedAt: isoDateSchema.optional(),
  domain: z.string().min(1),
  sourceType: sourceTypeSchema,
  body: z.string().min(1),
  contentHash: z.string().min(1),
  retrievedAt: isoDateSchema,
});

export const sourceChunkSchema = z.object({
  id: idSchema,
  sourceId: idSchema,
  projectId: idSchema,
  chunkIndex: z.number().int().min(0),
  text: z.string().min(1),
  startChar: z.number().int().min(0),
  endChar: z.number().int().min(1),
  embeddingModel: z.literal("text-embedding-3-small"),
  embeddingDimensions: z.literal(1536),
});

export const claimSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  statement: z.string().min(1),
  normalizedKey: z.string().min(1),
  claimType: claimTypeSchema,
  qualifiers: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  reviewStatus: claimReviewStatusSchema,
  createdAt: isoDateSchema,
});

export const evidenceLinkSchema = z.object({
  id: idSchema,
  claimId: idSchema,
  chunkId: idSchema,
  projectId: idSchema,
  relation: evidenceRelationSchema,
  strength: evidenceStrengthSchema,
  quote: z.string().min(1),
  rationale: z.string().min(1),
});

export const claimRelationSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  fromClaimId: idSchema,
  toClaimId: idSchema,
  relation: claimRelationTypeSchema,
  rationale: z.string().min(1),
});

export type Project = z.infer<typeof projectSchema>;
export type ResearchRun = z.infer<typeof researchRunSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type SourceChunk = z.infer<typeof sourceChunkSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;
export type ClaimRelation = z.infer<typeof claimRelationSchema>;
```

- [x] Run the focused test and verify GREEN.
- [x] Commit as `feat: 增加研究领域实体模型`.

## Task 2: Add deterministic source utilities

**Files:**
- Modify: `tests/unit/research-domain.test.ts`
- Create: `src/features/sources/source-utils.ts`

- [x] Add failing tests for canonical URL, content hash, and chunking.

```ts
import {
  canonicalizeUrl,
  chunkSourceText,
  createContentHash,
  extractDomain,
} from "@/features/sources/source-utils";

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
```

- [x] Run focused tests and verify RED.
- [x] Implement utilities with Node `crypto`, `URL`, and paragraph-aware chunking. Keep chunks between 800 and 1200 characters where possible and preserve offsets from the original text.
- [x] Run focused tests and verify GREEN.
- [x] Commit as `feat: 增加来源规范化与切块工具`.

## Task 3: Add claim and evidence validation utilities

**Files:**
- Modify: `tests/unit/research-domain.test.ts`
- Create: `src/features/claims/claim-utils.ts`

- [x] Add failing tests for normalized claim keys and exact quote validation.

```ts
import { createClaimKey, validateExactQuote } from "@/features/claims/claim-utils";

it("normalizes claim keys without losing meaning", () => {
  expect(createClaimKey(" Evidence Graph stores exact source quotes! ")).toBe(
    "evidence graph stores exact source quotes",
  );
});

it("accepts only exact quotes from saved chunks", () => {
  const chunkText = "The saved source says exact quotes must be preserved for review.";

  expect(validateExactQuote({ chunkText, quote: "exact quotes must be preserved" })).toEqual({
    ok: true,
    startChar: 22,
    endChar: 53,
  });
  expect(validateExactQuote({ chunkText, quote: "exact quotes should be preserved" })).toEqual({
    ok: false,
    reason: "QUOTE_NOT_FOUND",
  });
});
```

- [x] Run focused tests and verify RED.
- [x] Implement minimum utilities. `validateExactQuote` must not fuzzy-match or normalize away differences.
- [x] Run focused tests and verify GREEN.
- [x] Commit as `feat: 增加主张与引用校验工具`.

## Task 4: Add deterministic research fixtures

**Files:**
- Modify: `tests/unit/research-domain.test.ts`
- Create: `src/features/research/fixtures.ts`

- [x] Add a failing fixture test.

```ts
import { createDemoResearchFixture } from "@/features/research/fixtures";

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
```

- [x] Run focused tests and verify RED.
- [x] Implement fixture builders by composing schemas and utilities. Use fixed IDs and fixed ISO dates. Do not call providers or read network data.
- [x] Run focused tests and verify GREEN.
- [x] Commit as `test: 增加研究领域确定性夹具`.

## Task 5: Add in-memory project repository boundary

**Files:**
- Modify: `tests/unit/research-domain.test.ts`
- Create: `src/features/projects/project-repository.ts`

- [x] Add failing repository tests for owner isolation, source uniqueness, evidence quote rejection, and cascade delete.

```ts
import { createInMemoryProjectRepository } from "@/features/projects/project-repository";
import { createDemoResearchFixture } from "@/features/research/fixtures";

it("enforces owner isolation and project cascade deletion", () => {
  const repository = createInMemoryProjectRepository(createDemoResearchFixture());

  expect(repository.listProjects("user_ailian")).toHaveLength(1);
  expect(repository.listProjects("user_other")).toHaveLength(0);

  const projectId = repository.listProjects("user_ailian")[0].id;
  repository.deleteProject({ ownerId: "user_ailian", projectId });

  expect(repository.listProjects("user_ailian")).toHaveLength(0);
  expect(repository.listSources(projectId)).toHaveLength(0);
  expect(repository.listClaims(projectId)).toHaveLength(0);
});

it("rejects duplicate sources and non-exact evidence quotes", () => {
  const repository = createInMemoryProjectRepository(createDemoResearchFixture());
  const projectId = repository.listProjects("user_ailian")[0].id;
  const [source] = repository.listSources(projectId);
  const [claim] = repository.listClaims(projectId);
  const [chunk] = repository.listChunks(source.id);

  expect(() => repository.addSource(source)).toThrow("SOURCE_ALREADY_EXISTS");
  expect(() =>
    repository.addEvidenceLink({
      id: "link_bad_quote",
      projectId,
      claimId: claim.id,
      chunkId: chunk.id,
      relation: "supports",
      strength: "strong",
      quote: "not present in the chunk",
      rationale: "This should fail.",
    }),
  ).toThrow("QUOTE_NOT_FOUND");
});
```

- [x] Run focused tests and verify RED.
- [x] Implement the in-memory repository. Enforce `sources(project_id, canonical_url)`, `sources(content_hash)`, `claims(project_id, normalized_key)`, and `evidence_links(claim_id, chunk_id, relation)` uniqueness.
- [x] Run focused tests and verify GREEN.
- [x] Commit as `feat: 增加项目内存仓储边界`.

## Task 6: Close the research-domain module locally

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/development-plan.md`
- Modify: `README.md` if new commands or fixtures need documentation.

- [x] Run the full local gate.

```bash
npm run test:ci
```

Expected: lint, typecheck, unit, build, and e2e all pass without provider calls.

- [x] Run diff and safety checks.

```bash
git diff --check
git status -sb
git diff --stat
```

- [x] Update `PROJECT_STATUS.md` with branch `feat/research-domain`, local verification output, and note that provider calls remain disabled.
- [x] Update `docs/development-plan.md` to mark the research-domain module local gate complete only after the full gate passes.
- [x] Commit as `docs: 记录研究领域模块结果`.
- [x] Do not open a PR until the module is complete and PR #1 foundation review state is understood. If PR #1 is still open, keep this branch local and merge the accepted foundation branch into it before pushing.
