# Evidence Graph Project Status

Updated: 2026-07-15

## Current phase

- Phase: foundation and portfolio review.
- Branch: `feat/foundation-portfolio`.
- Pull request: [#1](https://github.com/Ailian0206/evidence-graph/pull/1) Draft.
- Active module: foundation and portfolio shell.
- External provider calls: disabled.
- Production deployment: not configured.
- Local gate: passed on 2026-07-15 with Node `v22.22.1`.

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
| Research domain foundation | Pending | Project/Source/Claim/Evidence schemas and deterministic fixtures |
| Research workflow | Pending | Idempotent mock workflow with exact-quote validation |
| Evidence workspace | Pending | Three-pane desktop and tabbed mobile workflow |
| Managed deployment | Pending | Supabase/Inngest/Vercel configuration after account authorization |

## Verification summary

- `npm run test:ci`: passed.
- `npm run test:e2e`: 16 passed; screenshots written to `output/playwright/`.
- Visual screenshots cover 390x844, 1024x768, and 1440x1000.
- Route screenshots cover `/zh`, `/en`, `/zh/work`, `/zh/evidence`, `/zh/notes`, and case-study pages.
- `git diff --check`: passed.
- Secret scan: no real secrets found; one false positive from the documented phrase `task-by-task`.
- Placeholder scan: no unfinished placeholders found; hits were explanatory documentation such as `no placeholder demos`.
- Environment note: local shell must use Node 22. Node 16 fails ESLint because `structuredClone` is unavailable.
- Review note: Cursor findings on localization, metadata, mobile navigation, and graph interaction were reviewed. The later pointer-leave regression was reproduced and fixed by separating persistent click selection from temporary hover and focus preview state.
- Automation note: Cursor Bugbot's monthly quota is exhausted, so it is no longer a merge gate. Codex review and the complete local and CI gates are the temporary fallback until a replacement review method is selected.

## Next action

Run the complete gate for the pointer-selection fix, update Draft PR #1 once, and merge after CI and Codex review pass without waiting for Bugbot.
