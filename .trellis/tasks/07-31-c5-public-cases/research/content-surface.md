# Existing C5 Content Surface

## Confirmed Reuse Points

- `src/features/reports/report-store.ts` resolves repository snapshots before Supabase and already validates the `PublicReport` contract.
- `src/features/reports/report-fixture.ts` provides stable demo reports and proves that `/r/[slug]` can remain available without managed services.
- `src/app/[locale]/(portfolio)/work/[slug]/page.tsx` is the Evidence Graph project case-study surface.
- `src/content/notes.ts` and `src/components/portfolio/note-rows.tsx` are the existing Notes index, but rows currently have no detail links.
- `src/components/portfolio/evidence-canvas.tsx` already provides accessible click/focus/hover inspection with stable responsive geometry, but its copy is synthetic and it has no decision node.
- `tests/e2e/public-routes.spec.ts`, `public-navigation.spec.ts`, `public-visual.spec.ts`, and `report-publishing.spec.ts` are the nearest behavior and visual gates.

## Private Evidence Reuse

`output/evidence-eval/live-observation.json` is ignored and mode-restricted. Its complete competition cases contain real linked evidence and can seed the Evidence Graph comparison case without a new paid call. Raw content remains private; only selected public URLs and exact excerpts may enter curated snapshots.

## Environment Observation

`npm run verify:managed-env` confirmed Supabase client/server variables but reported missing hosted Inngest and Sentry values. A direct managed Supabase read returned `TypeError: fetch failed` on 2026-07-31. C5 can proceed through deterministic content/UI work; new live research waits for connectivity and the paid-call gate.

## Decision

Use static curated case and report snapshots plus a localized Notes detail route. Do not add database schema, CMS, exporter, or a second report renderer.
