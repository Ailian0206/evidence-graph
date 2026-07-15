# Evidence Graph Development Plan

## Delivery strategy

Development is split into module branches and Draft PRs so CI and the configured review bot can inspect coherent milestones. Each module remains locally runnable and independently testable. Pull requests are created only after the current module reaches its local exit gate.

| Order | Branch | Scope | Local exit gate |
| ---: | --- | --- | --- |
| 1 | `feat/foundation-portfolio` | Next.js, bilingual portfolio, design system, tests, CI | Complete; PR [#1](https://github.com/Ailian0206/evidence-graph/pull/1) merged |
| 2 | `feat/research-domain` | Research entities, fixtures, project lifecycle, persistence boundary | Draft PR [#3](https://github.com/Ailian0206/evidence-graph/pull/3) open; CI pending |
| 3 | `feat/research-workflow` | Search/LLM provider interfaces, deterministic workflow, exact citations | Full mock research run produces a valid report |
| 4 | `feat/evidence-workspace` | Claim list, graph, source viewer, review actions, responsive app | Desktop/mobile e2e and graph interaction tests pass |
| 5 | `feat/managed-deployment` | Supabase Auth/RLS/pgvector, Inngest, Sentry, Vercel | Local gate plus authorized production smoke |

## Cross-module rules

- A module begins with a written plan under `docs/superpowers/plans/`.
- Every behavior change follows RED-GREEN-REFACTOR.
- Provider tests use fixtures unless a dedicated smoke command requires a confirmation token.
- Each module uses small Chinese Conventional Commits and one Draft PR; do not open separate PRs for intermediate commits.
- `PROJECT_STATUS.md` is updated when branch, PR, CI, or milestone state changes.
- A module is not complete until lint, typecheck, unit, build, and relevant Playwright checks pass.
- `docs/bugbot-autofix-workflow.md` defines the optional automated-review path and its Codex fallback. Quota or service unavailability must not block local progress or merging after the available review path passes.
- Continue the next local module task in a separate branch or worktree while remote checks run. Use a read-only monitor subagent only when active remote automation has a result worth waiting for.

## Current module

Review PR #3 CI, merge it with a merge commit when green, and continue `feat/research-workflow` locally while CI runs.
