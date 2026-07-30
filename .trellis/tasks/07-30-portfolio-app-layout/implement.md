# Implementation Plan

1. Add RED unit tests for portfolio/product layout ownership and compact product-shell behavior.
2. Move locale routes into `(portfolio)` and `(product)` groups without changing URL segments.
3. Reduce the locale root layout to shared providers, skip navigation, metadata, and analytics; add group layouts for their respective main landmarks and chrome.
4. Extend `ManagedAppShell` with portfolio return and locale actions plus entry mode; wrap login and anonymous Demo with entry mode.
5. Update direct module-path tests and bilingual AppShell messages.
6. Run focused unit tests, lint, typecheck, and build.
7. Run relevant E2E and browser verification at 390x844, 1024x768, and 1440x1000.
8. Review the complete diff, update Trellis specs only if a reusable convention was learned, commit, push, and finish the Trellis task.

## Rollback

Move grouped routes back to `src/app/[locale]/`, restore site chrome in the locale root layout, and revert optional product-shell props. No data rollback is required.
