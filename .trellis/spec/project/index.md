# Evidence Graph Project Guidelines

## Product Boundary

Evidence Graph is a bilingual, traceable AI research workspace. Preserve source-to-claim-to-evidence-to-report traceability, user isolation, bounded cost, idempotent background work, and a practical desktop/mobile interface. Do not add unrelated product scope.

## Workflow

- Trellis is the default workflow. New task artifacts belong under `.trellis/tasks/`.
- `docs/superpowers/` contains historical records only.
- Use a small direct-to-`main` commit for limited maintenance when `main` is clean and synchronized.
- Use one module branch and one Draft PR for milestones, database/auth/RLS/provider/deployment boundaries, cross-module contracts, new end-to-end workflows, dependency upgrades, or broad refactors.
- Use Chinese Conventional Commits. Do not squash, rebase, force-push, or include unrelated dirty files.

## Safety Gates

- Routine tests are fixture-only. Real provider calls require explicit approval and a positive cost cap.
- Never commit secrets, `.env` files, private source text, or paid-provider responses.
- Production is frozen through C6. Do not update `release`, Production data, migrations, environment variables, Inngest, or deployments without the release gate and explicit user authorization.
- Verify authorization, owner scoping, deletion cascades, and public-report invalidation for auth or data-lifecycle changes.

## Source Of Truth

- Product sequence and boundaries: `docs/roadmap.md`
- Current milestone and environment: `PROJECT_STATUS.md`
- Detailed repository workflow and gates: `AGENT.md` and `AGENTS.md`
- Installed Next.js behavior: `node_modules/next/dist/docs/`
