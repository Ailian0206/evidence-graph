# Evidence Graph Project Status

Updated: 2026-07-15

## Current phase

- Phase: research workflow final Codex review.
- Branch: `feat/research-workflow`.
- Pull request: not opened; the module remains local until final Codex review passes.
- Active module: deterministic research workflow.
- External provider calls: disabled.
- Production deployment: not configured.
- Local gate: complete with Node `v22.22.1`; lint, typecheck, 60 unit tests, build, and 18 E2E tests passed.
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
| Research domain foundation | Complete | PR [#3](https://github.com/Ailian0206/evidence-graph/pull/3) merged as `3fef13c` |
| Research workflow | Local gate complete; final review pending | Deterministic provider fixtures, resumable workflow, exact citations, retry and cost gates |
| Evidence workspace | Pending | Three-pane desktop and tabbed mobile workflow |
| Managed deployment | Pending | Supabase/Inngest/Vercel configuration after account authorization |

## Verification summary

- Research-domain `npm run test:ci`: 27 unit and 18 E2E tests passed before PR #3 merged.
- Focused `tests/unit/research-workflow.test.ts`: 33 passed after review remediation.
- Research-workflow `npm run test:ci`: lint, typecheck, 60 unit tests, build, and 18 E2E tests passed after merging the research-domain predecessor.
- Visual screenshots cover 390x844, 1024x768, and 1440x1000.
- Route screenshots cover `/zh`, `/en`, `/zh/work`, `/zh/evidence`, `/zh/notes`, and case-study pages.
- `git diff --check`: passed.
- Provider safety scan: no credentials, real OpenAI or Tavily endpoints, network provider implementations, or provider SDK dependencies found.
- Placeholder scan: no unfinished placeholders found; hits were explanatory documentation such as `no placeholder demos`.
- Environment note: local shell must use Node 22. Node 16 fails ESLint because `structuredClone` is unavailable.
- Review note: research-domain Codex review passed with no blocking findings. Research-workflow review remediation covers project ownership, cross-project isolation, report citations, entity ID collisions, retry usage, cost accounting, and ready-run immutability; final read-only review is pending.
- Automation note: Cursor Bugbot's monthly quota is exhausted, so no Bugbot monitor is running and Bugbot is not a merge gate. Codex review plus complete local and CI gates are the active fallback.
- Research-domain note: schemas, source utilities, claim quote validation, deterministic fixtures, and the in-memory repository use local fixtures only and make no provider calls.

## Next action

Run the final read-only Codex review. If it finds no blocker, push `feat/research-workflow` and open the module's single Draft PR; monitor CI without waiting for Bugbot.
