# Evidence Graph Agent Workflow

## Product boundary

Evidence Graph is a traceable AI research workspace and the primary project on Ailian's portfolio. The MVP turns a research question into persisted Sources, Claims, Evidence Links, conflicts, and a cited public report.

The portfolio has two real projects only:

- Evidence Graph: primary project, built in this repository.
- AI Photo Studio CN: an existing public engineering case study.

Do not add ProjectPilot AI, generic chat, billing, teams, browser extensions, OCR ingestion, or self-hosted models to the MVP.

## Engineering priorities

1. Evidence correctness and source traceability.
2. User and project data isolation.
3. Bounded cost and idempotent background work.
4. Quiet, operational frontend quality across mobile and desktop.
5. Reproducible local and CI verification.

## Workflow

1. Inspect `git status -sb` and the active plan.
2. Work on a module branch, preferably through `.worktrees/` after the baseline repository exists.
3. Write one failing test for one behavior and run it to observe the intended failure.
4. Implement the smallest change that passes the test.
5. Run focused verification, then refactor while green.
6. Before each commit, run `git diff --check`, inspect the diff, and stage only module files.
7. Use Chinese Conventional Commits.
8. Keep pull requests at module granularity. Do not create PRs for intermediate tasks, review-only cleanups, or every small commit.
9. At the module milestone, run the complete gate, push the branch, and create one Draft PR for that module.
10. Follow `docs/bugbot-autofix-workflow.md` when automated review is available. Automated review tools are optional accelerators, not merge gates; do not wait for or repeatedly trigger a tool whose quota is exhausted or whose service is unavailable.
11. When Cursor Bugbot Autofix is available and active, let it attempt the first fix for its findings. If Autofix fails, stalls, is unavailable, or the user disables the wait, Codex takes ownership after verifying the finding.
12. Review every automated or Codex-authored fix by inspecting the diff, running focused tests, and then running the module gate. Follow-up fixes stay on the same module branch and do not get a separate PR.
13. Use a read-only monitor subagent only while remote automation is active. Otherwise continue the main local development task without monitoring or waiting.
14. Merge with `gh pr merge <number> --merge --delete-branch` only after checks are green and the currently available review path has found no unresolved valid issue.

## Cost and external-write gates

Routine development uses deterministic provider fixtures. The following require explicit user authorization even when technically available:

- Adding real OpenAI or Tavily keys.
- Running a paid-provider smoke test.
- Buying or changing a domain.
- Creating paid Vercel, Supabase, Inngest, or Sentry resources.
- Publishing private identity or repository data not listed in `docs/product-plan.md`.

GitHub repository creation, module branches, pushes, Draft PRs, and normal PR maintenance are authorized by the user for this project.

## Verification gates

The repository must expose these commands once the foundation module lands:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
npm run test:ci
```

UI work must include Playwright screenshots at 390x844, 1024x768, and 1440x1000. Confirm there is no horizontal overflow, text clipping, incoherent overlap, blank primary visual, or layout shift caused by graph labels and controls.
