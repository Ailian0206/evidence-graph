# Evidence Graph Project Status

Updated: 2026-07-15

## Current phase

- Phase: research workflow planning.
- Branch: `feat/research-workflow`.
- Pull request: not opened; this stacked local branch will not be pushed until predecessor module PRs settle.
- Active module: deterministic research workflow.
- External provider calls: disabled.
- Production deployment: not configured.
- Local gate: inherited baseline passed on 2026-07-15 with Node `v22.22.1` before workflow changes.
- Foundation PR: [#1](https://github.com/Ailian0206/evidence-graph/pull/1) CI passed; Bugbot skipped on `2c7f51f` because of Cursor usage limits. One valid finding against Autofix commit `c4545d4` remains owned by an active Cursor Autofix run, so Codex has not raced it with a manual fix.

## Confirmed identity and portfolio content

- Brand: Ailian.
- Positioning: Senior frontend engineer expanding into full-stack and Agent engineering.
- Contact: `airenglian@gmail.com`.
- GitHub: `Ailian0206`.
- Public projects: Evidence Graph and AI Photo Studio CN.

## Milestones

| Module | Status | Exit gate |
| --- | --- | --- |
| Repository baseline | Complete | Plans, workflow docs, GitHub remote, clean `main` |
| Foundation and portfolio | Draft PR open | Local app, bilingual public pages, CI, visual QA, Draft PR |
| Research domain foundation | Local complete | Project/Source/Claim/Evidence schemas, deterministic fixtures, in-memory repository |
| Research workflow | Planning | Idempotent mock workflow with exact-quote validation |
| Evidence workspace | Pending | Three-pane desktop and tabbed mobile workflow |
| Managed deployment | Pending | Supabase/Inngest/Vercel configuration after account authorization |

## Verification summary

- `npm run test:ci`: inherited baseline passed on `feat/research-workflow` before module changes.
- `npm run test:unit`: 12 passed.
- `npm run test:e2e`: 16 passed; screenshots written to `output/playwright/`.
- Visual screenshots cover 390x844, 1024x768, and 1440x1000.
- Route screenshots cover `/zh`, `/en`, `/zh/work`, `/zh/evidence`, `/zh/notes`, and case-study pages.
- `git diff --check`: passed.
- Secret scan: no real secrets found; one false positive from the documented phrase `task-by-task`.
- Placeholder scan: no unfinished placeholders found; hits were explanatory documentation such as `no placeholder demos`.
- Environment note: local shell must use Node 22. Node 16 fails ESLint because `structuredClone` is unavailable.
- Review note: Earlier Cursor findings were addressed on PR #1. A later graph selection finding against `c4545d4` is valid and remains assigned to Cursor Autofix.
- Automation note: `docs/bugbot-autofix-workflow.md` assigns active findings to Cursor Autofix, keeps monitor subagents read-only, and requires Codex follow-ups to update the existing module PR instead of opening another PR.
- Research-domain note: schemas, source utilities, claim quote validation, deterministic fixtures, and the in-memory repository use local fixtures only and make no provider calls.

## Next action

Execute `docs/superpowers/plans/2026-07-15-research-workflow-plan.md` locally with fixture providers only. Do not push or open a PR while predecessor module PRs remain unsettled.
