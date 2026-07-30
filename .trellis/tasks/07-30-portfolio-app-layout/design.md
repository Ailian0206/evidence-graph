# Technical Design

## Route Structure

Keep `src/app/[locale]/layout.tsx` as the single locale root layout for `<html>`, `<body>`, i18n, metadata, skip navigation, and analytics. Move visual chrome into two non-root route groups so navigation between portfolio and product routes remains a client transition:

```text
src/app/[locale]/
  layout.tsx                    shared root only
  (portfolio)/
    layout.tsx                  SiteHeader + main + SiteFooter
    page.tsx                    /
    work/**                     /work/**
    notes/page.tsx              /notes
    evidence/page.tsx           /evidence
  (product)/
    layout.tsx                  pass-through route boundary
    auth/login/**               /auth/login
    app/**                      /app/**
```

Route Group names are omitted from URLs per the installed Next.js 16 documentation.

## Product Shell

Extend `ManagedAppShell` so `active` and `user` are optional. It owns the product header and the `main-content` landmark so skip navigation bypasses the header:

- Authenticated mode: product identity, workspace tabs, locale switch, account summary, sign out.
- Entry mode: product identity, locale switch, no protected tabs or account controls.

The product identity contains a compact icon link back to `/` and an `EG Evidence Graph` link to `/app`. Login and anonymous Demo use entry mode; managed pages keep authenticated mode.

## Compatibility

- Existing route URLs and OAuth callback paths do not change.
- Direct page-module imports in unit tests move to their new Route Group paths.
- Historical `docs/superpowers/` paths remain unchanged because they are records, not executable imports.
- Public `/r/[slug]` reports remain under their existing independent root layout.

## Risk Controls

- Add layout composition tests before moving files.
- Add shell tests for entry and authenticated modes.
- Run `next typegen` through `npm run typecheck` after route moves.
- Verify both public and product route families in a real browser at three required viewport sizes.
