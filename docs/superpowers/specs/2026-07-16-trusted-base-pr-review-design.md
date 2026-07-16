# Trusted-Base PR Review Design

## Context

Evidence Graph uses an independent Claude Code process as the required PR reviewer while Cursor Bugbot is unavailable. Normal pull requests can load `.claude/skills/pr-review/SKILL.md` from their own branch because they do not modify the reviewer. A pull request that changes the review protocol cannot safely certify itself with the version under review.

PR #6 is the one-time bootstrap. The user has reviewed and approved that bootstrap branch. After it merges, every later PR, including review-protocol changes, must complete without a human review gate.

## Goals

- Keep one coherent PR per module or independent bugfix.
- Run review and remediation without human approval steps.
- Prevent a review-protocol PR from loading the reviewer implementation it is changing.
- Preserve the existing `CLAUDE_REVIEWED_SHA`, `claude-reviewed`, and `claude-changes-requested` protocol.
- Let the main development process continue non-overlapping local work while independent review runs.

## Non-Goals

- Replacing CI, local tests, or project-specific verification gates.
- Allowing the reviewer to edit code, commit, push, create PRs, or merge.
- Restoring Cursor Bugbot or Autofix while its quota is unavailable.
- Automatically approving external-write, secret, paid-provider, or production gates.

## Trust Model

### Normal pull requests

The independent Claude process runs from the pull request checkout and invokes `/pr-review`. The repository skill reads the current PR diff, posts findings and a summary marker, and applies review-state labels.

### Review-protocol pull requests

The developer agent must not run the reviewer from the protocol PR checkout. It obtains the PR's `baseRefOid`, creates a temporary detached worktree at that exact SHA, and invokes the base version of `/pr-review` in trusted-base mode:

```bash
claude --permission-mode auto --model sonnet -p "/pr-review --trusted-base <pr-number>"
```

Trusted-base mode verifies all of these conditions before reviewing:

1. The requested PR is open.
2. The current detached worktree HEAD equals the PR's `baseRefOid`.
3. The target head SHA differs from the base SHA.
4. The review marker, if present, does not already match the target head SHA.

The reviewer then reads the target PR through `gh pr diff` and GitHub APIs. It never checks out or executes files from the target branch. The base reviewer is therefore the previously accepted implementation, not the rule under review.

The temporary worktree is removed after the Claude process exits. A failed cleanup is an operational error to report and retry; it does not make the review successful.

## Automated State Machine

1. The developer agent completes the module or bugfix locally and runs the full gate.
2. It pushes one module branch and opens or updates the existing Draft PR.
3. It records the PR number and current head SHA.
4. It selects normal mode or trusted-base mode from the changed paths.
5. It starts one independent Claude review process. A read-only monitor may own that process while the main agent continues non-overlapping work.
6. It waits to make a merge decision until CI and review reach terminal states.
7. If `claude-changes-requested` is present, the developer agent verifies each CRITICAL/HIGH finding, fixes valid issues through TDD on the same branch, runs focused and full gates, pushes once, and returns to step 3.
8. If `claude-reviewed` is present, `claude-changes-requested` is absent, and the marker SHA equals the PR head SHA, the review gate passes. MEDIUM/LOW findings are triaged automatically and fixed when technically justified.
9. When CI is green and no valid blocking finding remains, the developer agent marks the PR ready and merges with a merge commit, then deletes the remote branch.

No state in this sequence requires a human approval. Human input remains necessary only for the explicit cost and external-write gates already listed in `AGENT.md`.

## Failure Handling

- Claude exits non-zero: keep both review labels unchanged, record the failure, and retry once after checking authentication and command output.
- No matching SHA marker: treat the review as incomplete even if `claude-reviewed` exists.
- Marker SHA is stale: trigger a new pass for the current head.
- Both labels are absent: treat the review as incomplete.
- `claude-changes-requested` remains after a new clean pass: the reviewer removes it; the developer agent never removes it manually.
- Base SHA verification fails in trusted-base mode: stop without posting comments or labels and recreate the detached worktree from the exact `baseRefOid`.
- CI fails: fix the failure on the same branch and re-run review because the head SHA changed.

## Files and Responsibilities

- `~/.codex/skills/pr-review/SKILL.md`: Codex-side orchestration, mode selection, detached base worktree lifecycle, verdict checks, and automatic remediation loop.
- `.claude/skills/pr-review/SKILL.md`: Claude-side normal and trusted-base review procedures, guard checks, comments, markers, and labels.
- `.cursor/rules/pr-review-gate.mdc`: Cursor-side requirement to trigger the same automatic mode selection and prohibit human-only exceptions.
- `AGENT.md`: project merge gate and automatic reviewer ownership rules.
- `docs/bugbot-autofix-workflow.md`: durable workflow description and state transitions.

## Verification

The implementation is complete only after these scenarios pass:

1. A protocol-only PR reviewed from its own checkout is rejected without comments or labels.
2. Trusted-base mode rejects a worktree whose HEAD does not equal `baseRefOid`.
3. Trusted-base mode reviews the protocol PR from the exact base SHA and writes one summary marker plus the correct labels.
4. Re-running against the same head SHA writes nothing.
5. A normal non-protocol PR still follows `/pr-review` and preserves existing behavior.
6. The repository worktree remains unchanged after every review process.

## Delivery Sequence

1. Add trusted-base automation to PR #6, run CI, and use the user's bootstrap approval to merge it with a merge commit.
2. Start a clean developer-owned bugfix branch from updated `main`.
3. Reproduce the cross-project `contentHash` collision with a failing unit test, implement the project-scoped uniqueness rule, and run the complete gate.
4. Open one Draft bugfix PR, run the now-automatic Claude review flow, remediate any valid finding, and merge automatically when CI and review pass.
