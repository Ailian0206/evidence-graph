# C4 Evidence Eval and Evidence Quality Gate

## Goal

Turn the existing research workflow's quality claims into a repeatable, inspectable gate built around ten fixed research questions. The gate must show whether each MVP threshold passes and must identify the exact run, claim, evidence link, and citation involved in a failure.

## Background

- C3 and the portfolio/product layout split are complete and merged.
- The workflow already persists exact quotes, claim-to-evidence relations, citations, completion state, source domains, and estimated cost.
- Routine development and CI must remain deterministic and must not call paid providers.
- The user wants fast functional validation with narrowly bounded scope and cost.

## Fixed Question Set

### Technical selection

1. For a small production AI research application, when is PostgreSQL with pgvector preferable to a dedicated vector database?
2. For durable multi-step research, what reliability trade-offs distinguish Inngest from synchronous server execution?
3. How do exact quote storage and source chunk boundaries affect citation verifiability in retrieval-augmented generation systems?
4. For authenticated Next.js mutations, what trade-offs distinguish Server Actions from Route Handlers?

### Product competition

5. How do Perplexity, Elicit, and Consensus differ in source traceability and claim-level verification?
6. How do AI research assistants surface supporting, qualifying, and contradictory evidence?
7. Which review controls distinguish evidence-first research workspaces from general AI search summaries?

### Market facts

8. What published evidence since 2024 measures generative AI adoption in knowledge work?
9. What current public pricing and usage limits matter when combining web search, language models, and embeddings for an MVP?
10. Which EU and US requirements or guidance since 2024 affect disclosure and traceability of AI-assisted research outputs?

## Requirements

1. A versioned manifest must define exactly ten stable question IDs and cover technical selection, product competition, and market facts.
2. The evaluator must accept structured run observations without depending on Supabase, Next.js, Inngest, or a provider at evaluation time.
3. The evaluator must compute these MVP metrics:
   - exact quote substring precision: 100%
   - uncited factual report paragraphs: 0
   - manually sampled Evidence Relation accuracy: at least 90%
   - evidence-linked source domains for every usable completed case: at least 4
   - run completion rate: at least 90%
   - estimated cost for every run: at most USD 1
4. Invalid or missing traceability references must fail the gate instead of being omitted from a denominator.
5. Every failure must include the metric, case ID, run ID, and all applicable claim, evidence-link, chunk, report, and citation IDs.
6. A deterministic fixture dataset must cover all ten questions, include manual relation labels, pass all thresholds, and require no network access.
7. A repository command must write a structured summary under ignored `output/evidence-eval/` and return a non-zero exit code when the gate fails.
8. Real evaluation input and output must remain ignored and must never include paid-provider responses in Git.
9. Every real run must require a dedicated confirmation value, use a positive aggregate cost cap no greater than USD 0.50, and retain the existing local per-run cap no greater than USD 0.15. Authorization comes only from the user, never from this task artifact.

## Acceptance Criteria

- [x] The fixed manifest contains ten unique IDs with at least one question in every required category.
- [x] Unit tests demonstrate RED then GREEN behavior for exact quote, uncited factual paragraph, relation accuracy, domain coverage, completion, cost, and broken traceability references.
- [x] `npm run eval:evidence:fixture` completes without external calls, writes JSON output, reports all six metrics, and passes.
- [x] Re-running the fixture command produces the same metric values and failure list.
- [x] A failing input produces a non-zero process exit and a failure record traceable to concrete entity IDs.
- [x] Agent inspection confirms one technical, one competition, and one market fixture sample has a complete source-to-claim-to-evidence-to-citation path.
- [x] The focused tests, provider boundary check, lint, typecheck, unit suite, production build, and E2E suite pass before PR review.
- [ ] The milestone uses one Draft PR, independent Claude review, CI, and a merge commit.
- [x] Real ten-question execution remained blocked until the user separately approved the paid call and a USD 0.50 aggregate cap.
- [x] The approved real run completed all ten questions and twenty manual relation samples without committing source text or Provider responses.
- [ ] The real observation passes all six thresholds; the first full batch failed source-domain coverage in eight cases, the first rerun stopped on case three, and the second rerun stopped on case six with `EVIDENCE_DOMAIN_COVERAGE_LOW`.

## Out of Scope

- A general evaluation platform, web dashboard, leaderboard, or new database tables.
- Changing provider vendors or prompts solely to improve scores before a measured failure exists.
- C5 case-study content, C6 release-candidate work, Production writes, `release` updates, or deployment changes.
- Committing source bodies, provider responses, secrets, or real private research output.
