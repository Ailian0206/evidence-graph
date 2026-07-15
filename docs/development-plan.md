# Evidence Graph Development Plan

## Delivery strategy

Development is split into module branches and Draft PRs so CI and the configured review bot can inspect coherent milestones. Each module remains locally runnable and independently testable. Pull requests are created only after the current module reaches its local exit gate.

| Order | Branch | Scope | Local exit gate |
| ---: | --- | --- | --- |
| 1 | `feat/foundation-portfolio` | Next.js, bilingual portfolio, design system, tests, CI | PR [#1](https://github.com/Ailian0206/evidence-graph/pull/1) merged |
| 2 | `feat/research-domain` | Research entities, fixtures, project lifecycle, persistence boundary | Local gate complete; final Codex review pending |
| 3 | `feat/research-workflow` | Search/LLM provider interfaces, deterministic workflow, exact citations | Implementation complete; combined predecessor gate pending |
| 4 | `feat/evidence-workspace` | Claim list, graph, source viewer, review actions, responsive app | Desktop/mobile e2e and graph interaction tests pass |
| 5 | `feat/managed-deployment` | Supabase Auth/RLS/pgvector, Inngest, Sentry, Vercel | Local gate plus authorized production smoke |

## Cross-module rules

- A module begins with a written plan under `docs/superpowers/plans/`.
- Every behavior change follows RED-GREEN-REFACTOR.
- Provider tests use fixtures unless a dedicated smoke command requires a confirmation token.
- Each module uses small Chinese Conventional Commits and one Draft PR; do not open separate PRs for intermediate commits.
- `PROJECT_STATUS.md` is updated when branch, PR, CI, or milestone state changes.
- A module is not complete until lint, typecheck, unit, build, and relevant Playwright checks pass.
- `docs/bugbot-autofix-workflow.md` defines the PR review state machine. Autofix owns active Bugbot findings; Codex reviews and integrates its completed output and only fixes a verified remainder on the same module branch without opening another PR.
- Waiting for CI or an available review automation does not block unrelated local progress. Use a read-only monitor only when remote automation is actively producing a useful result.

## Current module

Keep `feat/research-workflow` local until the research-domain module is accepted. Then merge the predecessor with a merge commit, rerun the complete gate, finish Codex review, and open one workflow Draft PR.
