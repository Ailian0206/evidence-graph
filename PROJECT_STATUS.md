# Evidence Graph Project Status

Updated: 2026-07-15

## Current phase

- Phase: research domain module review.
- Branch: `feat/research-domain`.
- Pull request: not opened; the completed module is in its final Codex review before its single Draft PR.
- Active module: research domain foundation.
- External provider calls: disabled.
- Production deployment: not configured.
- Local gate: post-review `npm run test:ci` passed on 2026-07-15 with Node `v22.22.1`.
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
| Research workflow | Pending | Idempotent mock workflow with exact-quote validation |
| Evidence workspace | Pending | Three-pane desktop and tabbed mobile workflow |
| Managed deployment | Pending | Supabase/Inngest/Vercel configuration after account authorization |

## Verification summary

- Post-review `npm run test:ci`: passed on `feat/research-domain` with 25 unit and 18 E2E tests.
- Visual screenshots cover 390x844, 1024x768, and 1440x1000.
- Route screenshots cover `/zh`, `/en`, `/zh/work`, `/zh/evidence`, `/zh/notes`, and case-study pages.
- `git diff --check`: passed.
- Secret scan: no real secrets found; one false positive from the documented phrase `task-by-task`.
- Placeholder scan: no unfinished placeholders found; hits were explanatory documentation such as `no placeholder demos`.
- Environment note: local shell must use Node 22. Node 16 fails ESLint because `structuredClone` is unavailable.
- Review note: two Codex review rounds found and fixed owner-isolation, evidence-integrity, chunk-boundary, uniqueness, cascade, immutable-record, and semantic claim-key gaps. A final read-only follow-up review is in progress.
- Automation note: Cursor Bugbot's monthly quota is exhausted, so it is no longer a merge gate. Codex review and complete local and CI gates are the temporary fallback until a replacement is selected.
- Research-domain note: schemas, source utilities, claim quote validation, deterministic fixtures, and the in-memory repository use local fixtures only and make no provider calls.

## Next action

Complete Codex review, then push and open exactly one Draft PR for the completed research-domain module. Continue `feat/research-workflow` locally while remote CI runs.
