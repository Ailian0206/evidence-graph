# Research Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, provider-free research workflow that can resume safely, enforces source and cost limits, preserves exact evidence quotes, and produces a cited report without network calls.

**Architecture:** A pure TypeScript orchestrator depends on three provider contracts and an in-memory workflow store. Deterministic fixture providers exercise the same boundaries that future Tavily, OpenAI, and Inngest adapters will use, while step checkpoints and idempotency keys prevent completed provider work from running twice. Report validation rejects factual sections without persisted evidence links and exact source quotes.

**Tech Stack:** TypeScript, Zod, Vitest, existing research-domain schemas and utilities. No Inngest, Supabase, Tavily, OpenAI, or paid-provider SDK is added in this module.

---

## Scope boundaries

This module includes:

- `SearchProvider.search`, `LanguageModel.generateStructured`, and `EmbeddingProvider.embed` contracts.
- Deterministic fixture providers with call recording and controlled failure injection.
- A local workflow store for run state, step checkpoints, logs, generated entities, embeddings, and reports.
- The full `queued` to `ready` mock workflow with exact-quote and citation validation.
- Resume behavior, idempotency keys, source limits, content limits, and the USD 1 hard cost limit.

This module does not include:

- Real Tavily, OpenAI, Supabase, or Inngest adapters.
- Authentication, RLS, concurrent-user locking, UI, report publication, or public report routes.
- Real network retries. Fixture failure and resume tests establish the contract that a later Inngest adapter will call.

## File map

- Create `src/providers/contracts.ts` for provider inputs, outputs, usage accounting, and interfaces.
- Create `src/providers/fixtures/research-providers.ts` for deterministic provider implementations and call inspection.
- Create `src/features/research/workflow-types.ts` for structured model outputs, checkpoints, run logs, embeddings, and reports.
- Create `src/features/research/workflow-store.ts` for the in-memory idempotent persistence boundary.
- Create `src/features/research/run-research-workflow.ts` for orchestration, validation, limits, and resume behavior.
- Create `tests/unit/research-workflow.test.ts` for provider, workflow, idempotency, failure, and cost behavior.
- Modify `PROJECT_STATUS.md` and `docs/development-plan.md` only when module state changes.

## Task 1: Define provider contracts and deterministic fixtures

**Files:**

- Create: `src/providers/contracts.ts`
- Create: `src/providers/fixtures/research-providers.ts`
- Create: `tests/unit/research-workflow.test.ts`

- [ ] **Step 1: Write the failing provider-boundary test**

```ts
import { describe, expect, it } from "vitest";

import { searchResultSchema } from "@/providers/contracts";
import { createFixtureResearchProviders } from "@/providers/fixtures/research-providers";

describe("research provider fixtures", () => {
  it("returns deterministic structured data and records idempotency keys", async () => {
    const first = createFixtureResearchProviders();
    const second = createFixtureResearchProviders();

    const firstSearch = await first.search.search({
      query: "traceable AI research",
      maxResults: 12,
      idempotencyKey: "run_demo:searching:0",
    });
    const secondSearch = await second.search.search({
      query: "traceable AI research",
      maxResults: 12,
      idempotencyKey: "run_demo:searching:0",
    });

    expect(firstSearch).toEqual(secondSearch);
    expect(searchResultSchema.array().parse(firstSearch.data)).toHaveLength(2);
    expect(first.calls).toEqual([
      expect.objectContaining({ operation: "search", idempotencyKey: "run_demo:searching:0" }),
    ]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

Expected: FAIL because the provider contracts and fixture providers do not exist.

- [ ] **Step 3: Implement the minimum provider boundary**

`src/providers/contracts.ts` must export:

```ts
export type ProviderUsage = {
  estimatedCostUsd: number;
  searchCount: number;
  tokenCount: number;
};

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
```

`SearchResult` must contain URL, title, body, source type, and optional author and publication time. `ResearchModelOperation` is exactly `plan`, `extract_claims`, `link_evidence`, `detect_conflicts`, or `draft_report`.

`createFixtureResearchProviders` must return the three providers plus a shared `calls` array. Fixture outputs and usage are fixed. The factory accepts optional `failOnceAt`, `invalidQuote`, `searchResultCount`, and per-operation cost overrides so later tests can exercise failures and source caps without network access.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

Expected: 1 workflow test passes and no provider performs network I/O.

- [ ] **Step 5: Commit**

```bash
git add src/providers/contracts.ts src/providers/fixtures/research-providers.ts tests/unit/research-workflow.test.ts
git commit -m "feat: 建立研究 Provider 夹具边界"
```

## Task 2: Add workflow records and an idempotent store

**Files:**

- Create: `src/features/research/workflow-types.ts`
- Create: `src/features/research/workflow-store.ts`
- Modify: `tests/unit/research-workflow.test.ts`

- [ ] **Step 1: Write failing store tests**

Add tests that require:

```ts
const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());

expect(store.requireRun({ runId: "run_demo", ownerId: "user_ailian" }).status).toBe("queued");
expect(() => store.requireRun({ runId: "run_demo", ownerId: "user_other" })).toThrow(
  "RUN_NOT_FOUND",
);

store.saveCheckpoint({
  runId: "run_demo",
  step: "planning",
  idempotencyKey: "run_demo:planning",
  output: { queries: ["traceable AI research"] },
  completedAt: "2026-07-15T00:01:00.000Z",
});

expect(store.getCheckpoint("run_demo", "planning")?.idempotencyKey).toBe(
  "run_demo:planning",
);
expect(() =>
  store.saveCheckpoint({
    runId: "run_demo",
    step: "planning",
    idempotencyKey: "different-key",
    output: {},
    completedAt: "2026-07-15T00:02:00.000Z",
  }),
).toThrow("STEP_ALREADY_COMPLETED");
```

Also require duplicate-safe upserts for generated sources, chunks, claims, evidence links, relations, embeddings, and one report per run.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

Expected: FAIL because workflow records and the store do not exist.

- [ ] **Step 3: Implement workflow records and store**

Define Zod-backed types for:

- Search plan queries, extracted claim candidates, evidence candidates, conflict candidates, and report section drafts.
- `WorkflowCheckpoint` with run ID, step, idempotency key, opaque output, and completion time.
- `RunLogEntry` with step, status (`started`, `completed`, `failed`, `skipped`), attempt, timestamp, and optional error code.
- `EmbeddedChunk` with chunk ID, model `text-embedding-3-small`, dimensions `1536`, and the fixture vector.
- `ResearchReport` with run ID, project ID, Markdown, factual sections, citation snapshots, version, and creation time.

The store must enforce owner isolation through `requireRun`, preserve one checkpoint per run and step, use deterministic entity IDs, and expose immutable snapshots for tests. It must reuse `validateExactQuote` before saving evidence and reject a factual report section whose citation list is empty or references a missing evidence link.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

- [ ] **Step 5: Commit**

```bash
git add src/features/research/workflow-types.ts src/features/research/workflow-store.ts tests/unit/research-workflow.test.ts
git commit -m "feat: 增加研究工作流幂等存储"
```

## Task 3: Execute the deterministic research state machine

**Files:**

- Create: `src/features/research/run-research-workflow.ts`
- Modify: `tests/unit/research-workflow.test.ts`

- [ ] **Step 1: Write the failing full-run test**

```ts
it("runs the deterministic workflow to a fully cited report", async () => {
  const providers = createFixtureResearchProviders();
  const store = createInMemoryResearchWorkflowStore(createDemoResearchFixture());

  const result = await runResearchWorkflow({
    runId: "run_demo",
    ownerId: "user_ailian",
    manualSources: [],
    providers,
    store,
    now: () => "2026-07-15T01:00:00.000Z",
  });

  expect(result.run).toMatchObject({ status: "ready", step: "ready" });
  expect(result.report.sections.every((section) => !section.factual || section.citationIds.length > 0)).toBe(true);
  expect(result.report.citations.every((citation) => citation.quote.length > 0)).toBe(true);
  expect(result.evidenceLinks.map((link) => link.relation)).toEqual(
    expect.arrayContaining(["supports", "rebuts"]),
  );
  expect(result.completedSteps).toEqual([
    "planning",
    "searching",
    "collecting",
    "indexing",
    "extracting_claims",
    "linking_evidence",
    "detecting_conflicts",
    "drafting_report",
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

Expected: FAIL because `runResearchWorkflow` does not exist.

- [ ] **Step 3: Implement the minimum orchestrator**

For each state-machine step:

1. Check for an existing checkpoint and skip completed work.
2. Mark the run `running`, update the current step, and append a `started` log.
3. Use an idempotency key in the format `<runId>:<step>`; searching appends the query index.
4. Parse every provider output through its Zod schema before persistence.
5. Accumulate search count, token count, and estimated cost on the run.
6. Save generated entities and the step checkpoint before moving forward.
7. Append a `completed` log.

The orchestrator accepts optional manual source records, rejects more than the run's `manualUrlLimit`, and merges them with search results before collecting. Collecting must canonicalize URLs, deduplicate by canonical URL and content hash, cap the merged result at the run's `sourceLimit`, and reject total persisted body text beyond `maxContentChars`. Indexing must reuse `chunkSourceText` and require 1536-dimensional fixture embeddings. Linking evidence must reject non-exact quotes and preserve both supporting and rebutting evidence. Drafting must include only claims with saved evidence links and build citation snapshots from saved sources and chunks.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

- [ ] **Step 5: Commit**

```bash
git add src/features/research/run-research-workflow.ts tests/unit/research-workflow.test.ts
git commit -m "feat: 实现确定性研究状态机"
```

## Task 4: Enforce resume, exact-quote, and cost failure behavior

**Files:**

- Modify: `src/features/research/run-research-workflow.ts`
- Modify: `src/features/research/workflow-store.ts`
- Modify: `tests/unit/research-workflow.test.ts`

- [ ] **Step 1: Write failing idempotency and resume tests**

Require that running an already-ready run returns the stored report without adding provider calls or duplicate entities. Configure `failOnceAt: "extract_claims"`, run once to obtain `failed`, then run again and verify planning, searching, collecting, and indexing are not repeated while extraction is attempted twice.

- [ ] **Step 2: Write failing correctness-limit tests**

Require these exact outcomes:

```ts
expect(invalidQuoteResult.run).toMatchObject({
  status: "failed",
  step: "failed",
  errorMessage: "QUOTE_NOT_FOUND",
});
expect(invalidQuoteResult.report).toBeUndefined();

expect(overBudgetResult.run.errorMessage).toBe("RUN_COST_LIMIT_EXCEEDED");
expect(
  overBudgetProviders.calls.some((call) => call.operation === "extract_claims"),
).toBe(false);
```

Also verify that merged search and manual sources are capped at `sourceLimit`, and cover `MANUAL_URL_LIMIT_EXCEEDED`, `CONTENT_LIMIT_EXCEEDED`, and owner mismatch.

- [ ] **Step 3: Run the focused tests and verify RED**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

- [ ] **Step 4: Implement failure and resume semantics**

- Convert known validation and limit errors into a failed run with a stable error code and failed log entry.
- Never delete completed checkpoints after failure.
- On retry, append `skipped` logs for completed steps and resume at the first missing checkpoint.
- Allow at most three attempts for one failed provider step; the fourth request returns `STEP_RETRY_LIMIT_EXCEEDED` without another provider call.
- Stop before the next provider call when accumulated estimated cost reaches USD 1.
- A ready run is immutable and returns its stored result without invoking providers.
- Unknown exceptions use `WORKFLOW_FAILED` without leaking provider payloads or source text into logs.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

- [ ] **Step 6: Commit**

```bash
git add src/features/research/run-research-workflow.ts src/features/research/workflow-store.ts tests/unit/research-workflow.test.ts
git commit -m "test: 覆盖研究工作流恢复与成本门禁"
```

## Task 5: Close the research-workflow module locally

**Files:**

- Modify: `PROJECT_STATUS.md`
- Modify: `docs/development-plan.md`
- Modify: `docs/superpowers/plans/2026-07-15-research-workflow-plan.md`

- [ ] **Step 1: Run the focused workflow suite**

```bash
npm run test:unit -- tests/unit/research-workflow.test.ts --reporter=dot
```

Expected: all workflow tests pass with fixture providers only.

- [ ] **Step 2: Run the complete local module gate with Node 22**

```bash
npm run test:ci
git diff --check
git status -sb
```

Expected: lint, typecheck, unit, build, and 16 existing public E2E tests pass; no external provider call is made.

- [ ] **Step 3: Inspect provider-call safety**

```bash
rg -n "api\.openai\.com|api\.tavily\.com|OPENAI_API_KEY|TAVILY_API_KEY" src tests
```

Expected: no real endpoint or key use. Contract names in documentation are acceptable; executable provider code remains fixture-only.

- [ ] **Step 4: Update module state**

Mark the plan tasks complete, record exact test counts in `PROJECT_STATUS.md`, and mark the research-workflow local exit gate complete in `docs/development-plan.md`.

- [ ] **Step 5: Commit the module result**

```bash
git add PROJECT_STATUS.md docs/development-plan.md docs/superpowers/plans/2026-07-15-research-workflow-plan.md
git commit -m "docs: 记录研究工作流模块结果"
```

- [ ] **Step 6: Keep the branch local**

Do not push or open a PR until the foundation and research-domain module PR sequence is settled. Before the eventual module PR, merge accepted predecessor branches with merge commits, rerun `npm run test:ci`, then create exactly one Draft PR for `feat/research-workflow`.
