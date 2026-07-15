# Evidence Graph Development Plan

## Delivery strategy

Development is split into module branches and Draft PRs so CI and the configured review bot can inspect coherent milestones. Each module remains locally runnable and independently testable.

| Order | Branch | Scope | Local exit gate |
| ---: | --- | --- | --- |
| 1 | `feat/foundation-portfolio` | Next.js, bilingual portfolio, design system, tests, CI | Local gate complete; Draft PR pending |
| 2 | `feat/research-domain` | Research entities, fixtures, project lifecycle, persistence boundary | Domain and integration tests pass without network |
| 3 | `feat/research-workflow` | Search/LLM provider interfaces, deterministic workflow, exact citations | Full mock research run produces a valid report |
| 4 | `feat/evidence-workspace` | Claim list, graph, source viewer, review actions, responsive app | Desktop/mobile e2e and graph interaction tests pass |
| 5 | `feat/managed-deployment` | Supabase Auth/RLS/pgvector, Inngest, Sentry, Vercel | Local gate plus authorized production smoke |

## Cross-module rules

- A module begins with a written plan under `docs/superpowers/plans/`.
- Every behavior change follows RED-GREEN-REFACTOR.
- Provider tests use fixtures unless a dedicated smoke command requires a confirmation token.
- Each module uses small Chinese Conventional Commits and one Draft PR.
- `PROJECT_STATUS.md` is updated when branch, PR, CI, or milestone state changes.
- A module is not complete until lint, typecheck, unit, build, and relevant Playwright checks pass.

## Current module

Close `docs/superpowers/plans/2026-07-15-foundation-portfolio-plan.md` by pushing `feat/foundation-portfolio` and opening a Draft PR.
