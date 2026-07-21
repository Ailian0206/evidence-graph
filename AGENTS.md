<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Guidelines

1. Read `AGENT.md`, `PROJECT_STATUS.md`, and the active module plan before changing code.
2. Use test-driven development for behavior changes: verify RED, implement the minimum GREEN, then refactor.
3. Keep all code comments in English. User-facing content must support Chinese and English.
4. Keep provider calls disabled in routine tests. Real OpenAI or Tavily calls require a dedicated confirmation gate and cost cap.
5. Follow the minimum-change principle. Do not refactor unrelated modules.
6. Run the smallest relevant test after each change and the full module gate before a milestone PR.
7. Update `PROJECT_STATUS.md` when a module branch, PR, CI state, or project milestone changes; routine direct-to-main maintenance does not require a status entry unless it changes project state.
8. Use Chinese Conventional Commits. One logical change per commit.
9. After relevant verification, commit small bugs, local style/interaction changes, copy, tests, and limited documentation maintenance directly to a clean, synchronized `main` without a PR. Use module branches and one Draft PR for milestone work, including database/auth/RLS/provider/deployment boundaries, cross-module contracts, new end-to-end workflows, dependency upgrades, and broad refactors. Merge PRs with a merge commit; do not squash, rebase, or force push.
10. Never commit secrets, personal access tokens, `.env` files, generated reports containing private source text, or paid-provider responses.
