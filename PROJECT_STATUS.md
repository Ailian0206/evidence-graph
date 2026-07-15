# Evidence Graph Project Status

Updated: 2026-07-15

## Current phase

- Phase: research domain local completion.
- Branch: `feat/research-domain`.
- Pull request: not opened; module PR waits for foundation PR #1 state to settle.
- Active module: research domain foundation.
- External provider calls: disabled.
- Production deployment: not configured.
- Local gate: passed on 2026-07-15 with Node `v22.22.1`.
- Foundation PR: [#1](https://github.com/Ailian0206/evidence-graph/pull/1) CI passed; Bugbot skipped because of Cursor usage or spend limits, with no new inline findings after `2c7f51f`.

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
| Research workflow | Pending | Idempotent mock workflow with exact-quote validation |
| Evidence workspace | Pending | Three-pane desktop and tabbed mobile workflow |
| Managed deployment | Pending | Supabase/Inngest/Vercel configuration after account authorization |

## Verification summary

- `npm run test:ci`: passed on `feat/research-domain`.
- `npm run test:unit`: 12 passed.
- `npm run test:e2e`: 16 passed; screenshots written to `output/playwright/`.
- Visual screenshots cover 390x844, 1024x768, and 1440x1000.
- Route screenshots cover `/zh`, `/en`, `/zh/work`, `/zh/evidence`, `/zh/notes`, and case-study pages.
- `git diff --check`: passed.
- Secret scan: no real secrets found; one false positive from the documented phrase `task-by-task`.
- Placeholder scan: no unfinished placeholders found; hits were explanatory documentation such as `no placeholder demos`.
- Environment note: local shell must use Node 22. Node 16 fails ESLint because `structuredClone` is unavailable.
- Review note: Cursor Bugbot localization, metadata title, mobile navigation, evidence-canvas interaction, and mobile hero graph touch feedback addressed on PR #1.
- Automation note: Cursor Bugbot Autofix should attempt the first fix for new Bugbot findings; Codex reviews and integrates Autofix output before making any follow-up code changes.
- Research-domain note: schemas, source utilities, claim quote validation, deterministic fixtures, and the in-memory repository use local fixtures only and make no provider calls.

## Next action

Keep `feat/research-domain` local until foundation PR #1 is accepted or merged, then merge the accepted foundation branch into this worktree before pushing and opening one module PR.
