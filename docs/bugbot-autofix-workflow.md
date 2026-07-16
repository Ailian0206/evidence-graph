# Cursor Bugbot and Autofix Workflow

## Goals

- Pay for one coherent Bugbot review cycle per completed module instead of opening PRs for intermediate work.
- Give each Bugbot finding one fixer at a time so Cursor Autofix and Codex never implement the same fix concurrently.
- Keep local development moving while remote CI, Bugbot, and Autofix work is pending.

## Roles

| Actor | Responsibility | Write access during Autofix |
| --- | --- | --- |
| Cursor Bugbot | Review the current module PR head and report findings. | Review only |
| Cursor Autofix | Make the first fix attempt for findings created by Bugbot. | May write to its generated branch or the module branch |
| Monitor subagent | Observe PR checks, reviews, Autofix state, and Cursor-authored commits; report state changes to the main Codex process. | Read only |
| Main Codex process | Continue non-overlapping local module work, then review and integrate completed Autofix output. | Must not edit code owned by an active, available Autofix run |

## State machine

### 1. Develop the module locally

- Use small Chinese Conventional Commits on the module branch.
- Do not open PRs for individual tasks, review cleanups, documentation-only checkpoints, or unfinished module work.
- Finish the module plan and pass its complete local exit gate before creating one Draft PR.

### 2. Open one module Draft PR

- Push the completed module branch and open one Draft PR.
- Start one read-only monitor subagent only when CI, Bugbot, or Autofix is actively producing a result worth waiting for. It records the PR number, head SHA, check state, review SHA, automation run or branch, and bot-authored commits.
- The main Codex process immediately continues the next non-overlapping local task in a separate branch or worktree.

### 3. Reserve findings for Autofix

- From the moment Bugbot starts Autofix for a finding, that finding and its directly affected code are owned by Autofix.
- The monitor subagent and main Codex process must not fix, push, comment on, or trigger another agent for the same finding while Autofix is active.
- Autofix ownership ends when Cursor publishes a commit or patch, reports a terminal failure, becomes unavailable because of quota or service state, or the user explicitly disables the wait.

### 4. Review completed Autofix output

The monitor subagent reports the new commit or branch instead of integrating it. The main Codex process then:

1. Fetches the remote state and confirms the Autofix base and head SHAs.
2. Inspects the complete Autofix diff and maps each change back to a Bugbot finding.
3. Runs the smallest focused regression test for each finding.
4. Runs the complete module gate before the module PR is merged.

If Autofix committed directly to the module branch, keep the commit after it passes review. If Autofix used a Cursor branch or separate PR, integrate it into the existing module branch with a merge commit. Do not create another Codex PR for Autofix integration.

### 5. Handle an incorrect or incomplete Autofix

- After Autofix ownership has ended, Codex may take ownership of the remaining verified problem.
- Reproduce the problem with a failing test when behavior changes, implement the minimum fix, and commit it to the same module branch.
- Batch related review follow-ups into one verified push for that review cycle so the existing module PR updates once. Never open a second PR for the Codex follow-up.
- Do not rewrite or force-push Cursor commits.

### 6. Merge or keep working

- Merge the module PR with a merge commit only after CI is green, the currently available review path has completed, and no valid finding remains unresolved.
- A Bugbot usage-limit skip is missing automated coverage, not a code finding or merge blocker. Record it in `PROJECT_STATUS.md`, do not repeatedly retrigger paid reviews, use Codex review plus the complete module gate as the temporary fallback, and keep local work moving.

### 7. Claude review-only fallback (while Bugbot quota is exhausted)

A separate Claude Code session runs the `pr-review` skill (`.claude/skills/pr-review/SKILL.md`)
as a read-only stand-in for Bugbot: it never edits code, never commits, never opens
or merges a PR. It only posts inline + summary PR comments and applies two labels.

- `claude-reviewed` — a review pass has completed for the PR's current head SHA.
  Absence means no pass has happened yet at this commit; wait or trigger one
  before treating the PR as reviewed.
- `claude-changes-requested` — the most recent pass found an unresolved CRITICAL
  or HIGH finding. **Treat this the same as an unresolved Bugbot Critical finding
  under section 6: do not merge while it is present.** It is removed once a later
  pass confirms the finding is resolved.
- Every summary comment ends with `<!-- CLAUDE_REVIEWED_SHA: <sha> -->`. If that
  SHA does not match the PR's current head, the labels are stale — new commits
  landed after the last review and it needs another pass.

This runs independently of the main Codex process and on its own schedule; do not
wait synchronously for it the way section 2's monitor subagent waits for Bugbot.
Check label state before merging, same as any other merge-gate check in section 6.

## Monitor subagent contract

The monitor is deliberately read-only. It may use `gh pr view`, `gh pr checks`, `gh api`, `git fetch`, and remote log or diff commands. It must not edit files, create commits, push branches, comment on PRs, trigger Autofix, or merge.

Each report must include:

- Observed PR number and head SHA.
- CI and Bugbot check conclusions.
- Latest Bugbot review SHA and whether Autofix is active, complete, failed, or absent.
- Cursor-authored commit or branch SHAs discovered since the previous observation.
- Outstanding findings and the recommended next state transition.

Use at most one monitor subagent per active automation run and close it after it reports a terminal or actionable state. Do not create a monitor when automation is unavailable; start another only after a meaningful PR head or check-state change.

## PR cost controls

- One module equals one Draft PR.
- Local commits are allowed; PR creation is the cost boundary.
- Avoid nonessential pushes while the PR is under Bugbot review.
- Codex follow-up fixes update the existing module PR in one verified push per review cycle.
- Waiting on remote automation never blocks unrelated local module work.
