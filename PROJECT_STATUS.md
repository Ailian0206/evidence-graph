# Evidence Graph Project Status

Updated: 2026-07-15

## Current phase

- Phase: research workflow integration verification.
- Branch: `feat/research-workflow`.
- Pull request: not opened; this stacked local branch will not be pushed until the research-domain module settles.
- Active module: deterministic research workflow.
- External provider calls: disabled.
- Production deployment: not configured.
- Local gate: 20 focused workflow tests, lint, typecheck, 32 total unit tests, and build passed with Node `v22.22.1`; E2E awaits the accepted predecessor's worktree Turbopack root fix.
- Foundation PR: [#1](https://github.com/Ailian0206/evidence-graph/pull/1) merged as `0bf85a3` after CI and Codex review passed.

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
| Foundation and portfolio | Complete | PR #1 merged after CI, Codex review, and visual QA |
| Research domain foundation | Local complete; final review pending | Project/Source/Claim/Evidence schemas, deterministic fixtures, in-memory repository |
| Research workflow | Implementation complete; integration pending | Deterministic provider fixtures, resumable workflow, exact citations, retry and cost gates |
| Evidence workspace | Pending | Three-pane desktop and tabbed mobile workflow |
| Managed deployment | Pending | Supabase/Inngest/Vercel configuration after account authorization |

## Verification summary

- Focused `tests/unit/research-workflow.test.ts`: 20 passed.
- Partial `npm run test:ci`: lint, typecheck, 32 unit tests, and build passed; E2E stopped after three Client Manifest failures caused by the missing worktree `turbopack.root` predecessor fix.
- Visual screenshots cover 390x844, 1024x768, and 1440x1000.
- Route screenshots cover `/zh`, `/en`, `/zh/work`, `/zh/evidence`, `/zh/notes`, and case-study pages.
- `git diff --check`: passed.
- Secret scan: no real secrets found; one false positive from the documented phrase `task-by-task`.
- Placeholder scan: no unfinished placeholders found; hits were explanatory documentation such as `no placeholder demos`.
- Environment note: local shell must use Node 22. Node 16 fails ESLint because `structuredClone` is unavailable.
- Review note: a read-only Codex review of the complete research-workflow implementation is in progress.
- Automation note: Cursor Bugbot's monthly quota is exhausted, so no Bugbot monitor is running and Bugbot is not a merge gate. Codex review plus complete local and CI gates are the active fallback.
- Research-domain note: schemas, source utilities, claim quote validation, deterministic fixtures, and the in-memory repository use local fixtures only and make no provider calls.

## Next action

After the research-domain module is accepted, merge it with a merge commit, rerun `npm run test:ci`, complete Codex review, and only then open the research-workflow module's single Draft PR.
