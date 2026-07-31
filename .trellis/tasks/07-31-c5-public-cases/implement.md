# C5 Public Research Cases Implementation Plan

## Phase 1: Contracts And RED Tests

- [x] Add failing unit tests for exactly three fixed cases, localized required fields, article length, graph reference integrity, stable report slugs, and private-field exclusion.
- [x] Add failing report tests for curated snapshot lookup, citation completeness, HTTPS source URLs, and Supabase independence.
- [x] Add failing route/component tests for linked published Notes rows, localized case detail pages, real hero graph copy, and three case entries in the Evidence Graph case study.
- [x] Run the smallest test files and record the expected RED failures before implementation.

## Phase 2: Static Case And Report Boundaries

- [x] Define the typed public-case content contract and lookup helpers under `src/content/`.
- [x] Define curated public-report snapshots under `src/features/reports/` and add them before demo/Supabase lookup.
- [x] Populate case 2 from the existing private C4 observation without another Provider call.
- [x] Keep cases 1 and 3 content slots private/uncommitted until their source-backed snapshots exist; do not commit placeholder claims as real facts.
- [x] Run focused content and report tests to GREEN.

## Phase 3: Portfolio Integration

- [x] Extend Notes rows with published links while preserving non-linked draft behavior.
- [x] Add `/[locale]/notes/[slug]` with static params, localized metadata, article sections, decision/failure records, graph, and report link.
- [x] Feed real case data into the existing graph component with stable source/evidence/claim/decision node geometry.
- [x] Update the home hero and Evidence Graph project case study to use the real case graph and expose all three cases.
- [x] Add focused unit/E2E coverage and verify RED -> GREEN for each behavior.

## Phase 4: Public Source Verification

- [x] Diagnose managed development connectivity without changing Production; record the Supabase pooler authentication failure as an external environment gate.
- [x] Reuse the existing C4 observation for case 2 without another Provider call.
- [x] Inspect stable public documentation directly for cases 1 and 3; no paid Provider authorization or call was needed.
- [x] Verify exact public excerpts and source URLs without committing private output.
- [x] Complete all three articles, graphs, report snapshots, and failure/correction records from measured evidence.

## Phase 5: Verification And Milestone Close

- [x] Run focused content, public route, report publication, and visual tests.
- [x] Verify every external source link manually without adding brittle third-party network checks to CI.
- [ ] Run `npm run check:provider-boundary`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, `npm run test:e2e`, and `npm run test:managed`. All local code gates pass; `test:managed` remains blocked only by `HOSTED_SUPABASE_POOLER_AUTH_FAILED`.
- [x] Start the local app and inspect all three cases plus home -> Evidence Graph case study -> case -> report navigation.
- [x] Capture 390x844, 1024x768, and 1440x1000 screenshots and run the visible UI audit.
- [ ] Update project status, create one Draft PR, wait for CI, run independent Claude review immediately, fix verified findings, and merge with a merge commit.
- [ ] Archive the Trellis task and stop; do not start C6.

## Risk And Stop Conditions

- A paid Provider call without the explicit aggregate cap is forbidden.
- A failed live run does not authorize a retry; another call requires a new explicit authorization.
- If a source URL or exact quote cannot be verified, omit the claim rather than weakening citation rules.
- If managed connectivity remains unavailable, continue static/UI work and stop at the live-run gate without using Production.
- Do not commit placeholders, generated source bodies, Provider responses, user/account data, run logs, or costs.
