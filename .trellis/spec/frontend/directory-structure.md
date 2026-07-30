# Directory Structure

## Layout

```text
src/
  app/                 Next.js App Router pages, layouts, route handlers
  components/          Reusable UI grouped by product area
  features/            Domain logic, actions, stores, and repositories
  providers/           Fixture and live provider adapters
  inngest/             Background workflow entry points
  lib/                 Shared infrastructure such as Supabase clients
  i18n/                Locale routing and request configuration
tests/
  unit/                Vitest behavior and component tests
  e2e/                 Playwright user workflows
  provider-smoke/      Explicitly gated live-provider tests
supabase/
  migrations/          Database schema history
  tests/               pgTAP database and RLS tests
```

## Module Rules

- Keep route files thin. They authenticate, load data, and compose feature components, as in `src/app/[locale]/(product)/app/reports/page.tsx`.
- Keep locale-wide providers and metadata in `src/app/[locale]/layout.tsx`, but let `(portfolio)` and `(product)` Route Group layouts own their visual chrome. This preserves public URLs while preventing personal-site headers and footers from leaking into product routes.
- Put product rules and data adapters under `src/features/<domain>/`; `src/features/reports/report-list-store.ts` is the report-list example.
- Put reusable UI under `src/components/<domain>/`; colocate a CSS module when styling is domain-specific.
- Keep external service adapters under `src/providers/` or `src/lib/`, not inside React components.
- Put tests under the matching central test suite rather than beside production files.

## Naming

- Use kebab-case filenames and directories.
- Use PascalCase for React components and exported React prop types.
- Use camelCase for functions and values; factory functions start with `create`.
- Name Server Actions `actions.ts` within their feature and repositories or stores by their role.

Do not create a new shared layer for a single use. Extend the nearest existing domain module first.
