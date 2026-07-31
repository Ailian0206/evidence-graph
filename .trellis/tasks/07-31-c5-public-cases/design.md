# C5 Public Research Cases Technical Design

## Architecture

C5 is a repository-backed content and presentation milestone. It reuses the existing public-report route and portfolio shell instead of adding persistence or a CMS.

The implementation has three boundaries:

1. **Public case content** under `src/content/` owns localized case articles, graph labels, decisions, limitations, and report slug references.
2. **Public report snapshots** under `src/features/reports/` own the immutable sections and citations consumed by the existing `PublicReport` component and `/r/[slug]` route.
3. **Portfolio presentation** under the existing portfolio routes/components renders case indexes, detail pages, the Evidence Graph case-study rollup, and real hero graph media.

## Content Contracts

Add a finite `PublicResearchCase` contract containing:

- stable `slug`, `reportSlug`, and original report language;
- localized title, summary, question, research scope, decision, limitations, and failure/correction copy;
- localized article sections;
- a small graph containing source, evidence, claim, and decision nodes plus resolved edges;
- publication date and source-count metadata.

Keep public report snapshots in the existing `PublicReport` shape so `/r/[slug]`, metadata, print layout, and citation rendering do not fork. A lookup function checks curated C5 snapshots before the existing demo fixture and Supabase fallback. Demo fixtures remain deterministic test support but are no longer linked from primary portfolio surfaces.

## Routes And Data Flow

```text
src/content/public-research-cases.ts
  -> /[locale]/notes and home Notes rows
  -> /[locale]/notes/[slug]
  -> Evidence Graph project case study
  -> EvidenceCanvas real case graph input

src/features/reports/public-case-reports.ts
  -> getPublicReport(slug)
  -> /r/[slug]
  -> PublicReport
```

`generateStaticParams` returns the three case slugs for the localized Notes detail route. `generateMetadata` reads the same static content. The route stays a Server Component and passes only the selected serializable graph data into the interactive canvas.

## Graph Presentation

Extend the current canvas with an explicit data prop rather than creating a second graph system. The default demo data remains available only for existing fixture routes until all public surfaces supply a real case. The C5 graph uses stable dimensions and a source -> evidence -> claim -> decision sequence; clicking or focusing a node updates its localized inspector text without moving the layout.

## Real Research And Sanitization

- Reuse the C4 private competition observation for case 2.
- After explicit aggregate-cost approval and restored managed connectivity, run at most one normal product research for case 1 and one for case 3, each retaining the product's `0.15 USD` cap.
- Keep raw results under ignored `output/` with mode `0600`.
- Manually select public conclusions, exact excerpts, URLs, and failure/correction notes into the curated snapshots. Do not create a reusable exporter for three records.
- Verify source links during Agent acceptance; routine CI validates structure but does not depend on third-party availability.

## Compatibility And Safety

- Existing published Supabase reports continue to resolve after curated snapshots and the demo fixture miss.
- Existing demo slugs remain available for report tests, but portfolio links move to C5 report slugs.
- No schema, RLS, Auth, Provider adapter, or Production behavior changes.
- Static content must not contain IDs from the managed database, source bodies beyond cited public excerpts, request payloads, run logs, costs, or Provider responses.

## Rollback

All C5 behavior is isolated to static content, portfolio UI, report lookup order, and tests. Reverting the C5 commits restores the existing demo-linked portfolio without data migration or cleanup.
