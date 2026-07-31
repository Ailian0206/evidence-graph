# C5 Public Research Cases and Portfolio Backfill

## Goal

Publish the first three inspectable Evidence Graph research cases and replace the portfolio's development/demo claims with real, source-backed product results. A visitor must be able to move from the portfolio home page to the Evidence Graph case study, open each case article and graph, and inspect the corresponding cited public report.

## Background

- C4 passed its approved Evidence Eval thresholds and merged through PR #22.
- The product plan fixes the C5 topics and case count:
  1. Whether CyberVerse is suitable as a commercial product foundation for an independent developer.
  2. How Evidence Graph differs from ordinary AI search summaries.
  3. Whether Vercel, Railway, or Cloudflare is better suited to long-running AI research workflows.
- `/r/[slug]` already serves immutable repository snapshots before querying Supabase. Portfolio copy is repository-backed and bilingual.
- The C4 private observation contains completed real competition research that can seed case 2 without another Provider call.
- The managed development database was temporarily unreachable with `fetch failed` during planning on 2026-07-31. This does not block fixture-first implementation, but live runs require restored connectivity.

## Requirements

1. Publish exactly the three fixed cases; do not add a fourth case or silently change their product questions.
2. Each case must provide:
   - a stable localized portfolio URL under Notes;
   - a real research question and dated research scope;
   - an evidence-to-claim-to-decision graph derived from the case's public snapshot;
   - a Chinese case article between 800 and 1,500 Chinese characters with meaningful English localized copy;
   - the decision, important evidence, limitations, and a concrete failure-and-correction record;
   - a stable `/r/[slug]` report containing inspectable citations to public sources.
3. Every factual paragraph in a public report must reference at least one known citation. Every citation must contain a source title, an exact public quote, and an HTTPS source URL.
4. Public case data must be deterministic repository content. Private source bodies, Provider requests or responses, user identifiers, run logs, and cost details must remain outside Git.
5. Case 2 must reuse the existing C4 real observation where applicable. Cases 1 and 3 may each use at most one new product research run under the existing per-run `0.15 USD` cap. No paid call is allowed without a separate explicit aggregate cost authorization.
6. The portfolio home hero must display graph content from a real C5 case rather than the current synthetic interview copy.
7. The Evidence Graph project case study must summarize the measured C4 result and expose all three C5 cases and public report entries.
8. The Notes index and home Notes section must link published case rows to detail pages. Existing unpublished development notes may remain unlinked or be replaced only where the fixed C5 topics require it.
9. Chinese and English navigation, headings, labels, metadata, and summaries must be supported. C5 does not create translated report snapshots; each public report keeps its original research language.
10. Existing report publication, revoked/missing report 404 behavior, portfolio navigation, managed workspace, and fixture-only routine test boundaries must remain intact.

## Acceptance Criteria

- [x] Exactly three C5 case records exist with the fixed topics, stable unique slugs, report slugs, localized copy, graph data, and failure/correction records.
- [x] Unit tests reject missing localized content, Chinese articles outside 800-1,500 characters, uncited factual paragraphs, broken citation IDs, non-HTTPS source URLs, and graph references that do not resolve.
- [x] `/zh/notes/[slug]` and `/en/notes/[slug]` render all three static case pages with localized metadata and return 404 for unknown slugs.
- [x] Each case page exposes its decision graph and links to a stable public report.
- [x] All three public reports render without Supabase, expose openable source links, and keep every factual paragraph cited.
- [x] The home hero and Evidence Graph project case study use real C5 case data and contain no synthetic interview/source labels.
- [x] Agent inspection confirms titles, conclusions, main sources, graph nodes, citations, and failure/correction records for all three cases.
- [x] Link, report 404, SEO, print, and portfolio navigation checks pass.
- [x] 390x844, 1024x768, and 1440x1000 screenshots show no horizontal overflow, clipping, overlap, blank graph, or unreadable long copy.
- [x] Provider boundary, independent Claude review, GitHub CI, and merge-commit flow pass without committing private output. Local `test:managed` stopped only at `HOSTED_SUPABASE_POOLER_AUTH_FAILED`; the equivalent GitHub Supabase gate passed.

## Out of Scope

- A fourth case, CMS, article editor, report translation workflow, social sharing system, export, or generalized content ingestion pipeline.
- New database tables, migrations, RLS changes, authentication changes, or Production writes.
- Updating `release`, deploying Production, or starting C6.
- Changing Provider vendors or repeating a real run only to improve presentation.
