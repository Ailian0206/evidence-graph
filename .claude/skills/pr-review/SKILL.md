---
name: pr-review
description: Read-only code review for open pull requests in this repo. Diffs changed files, grades findings by severity (CRITICAL/HIGH/MEDIUM/LOW), posts inline and summary GitHub comments, and labels the PR to signal review state to the developer agent (Codex/Cursor). Never edits source files, creates branches, commits, or merges. Use when a PR was just opened/updated, or when polling for PRs that lack an up-to-date `claude-reviewed` marker.
---

# PR Review (Bugbot quota fallback)

This skill exists because Cursor Bugbot's monthly quota can run out, leaving PRs
merged without automated review. It replaces Bugbot for the *review* half only —
fixing is a separate agent's job (Codex/Cursor), per `docs/bugbot-autofix-workflow.md`.

## Hard boundary

This skill is **read-only with respect to code**. In one run it may:

- Read: `gh pr list/view/diff`, `gh api`, `Read`, `Grep`, `codegraph_*`.
- Run throwaway verification scripts (e.g. a Node one-liner to confirm a schema
  behaves as suspected) — never edit tracked files to do this.
- Write: PR comments (`gh pr comment`, `gh api .../pulls/{n}/comments`), PR labels
  (`gh pr edit --add-label` / `--remove-label`).

It must never: `Edit`/`Write` a tracked source file, `git commit`, `git push`,
create a branch, open a PR, or merge/close a PR. If a finding needs a code fix,
the fix belongs to the developer agent — describe the problem and a direction,
not a diff.

## Review-state protocol (how the dev agent finds out)

Every summary comment this skill posts ends with a hidden marker:

```
<!-- CLAUDE_REVIEWED_SHA: <head-sha> -->
```

- Before reviewing a PR, fetch its comments and look for the most recent marker.
  If its SHA equals the PR's current head SHA, the PR is already reviewed at this
  commit — skip it (idempotent; safe to re-run this skill often).
- If the head SHA has moved since the last marker (new commits pushed), review
  again — this is how a Codex fix-and-repush gets re-checked automatically.

Labels applied after each review pass:

- `claude-reviewed` — always applied once a review pass completes. Presence means
  "read the review comments," not "approved."
- `claude-changes-requested` — applied only when the pass found an unresolved
  CRITICAL or HIGH finding. Remove it on a later pass once those are resolved
  (keep `claude-reviewed`).

`docs/bugbot-autofix-workflow.md` tells the dev agent to check these labels before
merging a module PR, the same way it already checks Bugbot/CI state.

## Procedure

1. **Discover work.**
   ```
   gh pr list --state open --json number,headRefOid,title,isDraft,url
   ```
   For each PR, fetch comments (`gh api repos/{owner}/{repo}/issues/{n}/comments`)
   and check for a `CLAUDE_REVIEWED_SHA` marker matching `headRefOid`. Build the
   list of PRs that actually need a pass. If empty, stop — do not post anything.

2. **Read the diff, not just the summary.**
   ```
   gh pr diff <n>
   ```
   For files that are hard to judge from the diff alone (schema files, shared
   utilities, anything touching ownership/auth/money/citations in this project),
   read the full file with `Read`, not just the patch context.

3. **Verify before flagging — don't guess.** If a finding depends on library
   behavior you're not certain of (e.g. "does `.extend()` on a Zod schema keep a
   `.superRefine()`?"), write a 5-line throwaway script and run it rather than
   asserting from memory. Only report findings you've confirmed against the
   actual code or a runnable check.

4. **Grade findings** using this repo's existing severity scale
   (`~/.claude/rules/common/code-review.md`):

   | Level | Meaning | Action |
   |---|---|---|
   | CRITICAL | Security vulnerability or data loss risk | blocks merge |
   | HIGH | Bug or significant quality issue | should fix before merge |
   | MEDIUM | Maintainability concern | worth fixing, not blocking |
   | LOW | Style/minor, record and move on | optional |

   Check the standard categories: hardcoded secrets, injection, auth/ownership
   bypass, silent error swallowing, N+1/unbounded queries, missing tests for new
   behavior, and — specific to this project — provider-call safety (no real
   OpenAI/Tavily calls in routine tests) and evidence/citation integrity rules.

5. **Post findings.**
   - Concrete, file:line-anchored issues → inline comment via
     `gh api repos/{owner}/{repo}/pulls/{n}/comments -f commit_id=<head-sha>
     -f path=<file> -F line=<n> -f side=RIGHT -f body=...`. One comment per
     distinct issue; posting via this endpoint auto-creates and submits a review.
   - Always post one summary comment (`gh pr comment <n> --body ...`) listing
     every finding by severity (even ones already inline, briefly), overall
     verdict, and the `CLAUDE_REVIEWED_SHA` marker at the end.
   - Findings should describe: what's wrong, a concrete failure scenario
     (inputs/state → wrong output), and a fix direction — not a full diff.

6. **Apply labels** per the review-state protocol above.

7. **Stop.** Do not wait for the dev agent, do not re-review the same SHA twice,
   do not touch code.

## Out of scope: this skill's own operating rules

Never apply `claude-reviewed` or `claude-changes-requested`, and never post a
"review complete" comment, on a PR whose diff is entirely within
`.claude/skills/pr-review/` and/or the review-protocol section of
`docs/bugbot-autofix-workflow.md`. A PR that changes the reviewer's own rulebook
cannot be certified by that same rulebook — that is self-approval regardless of
how mechanical the change looks. Leave such PRs unlabeled; a human merges them
after reading the diff directly.

## Notes specific to this repo

- Drafts are in scope — `docs/bugbot-autofix-workflow.md` treats one module PR as
  one Draft PR under active review, same as Bugbot did.
- PR authorship in `gh pr list` won't reliably distinguish "Codex" from "human"
  from "Cursor" — everything pushes under the same git identity. Review every
  open PR needing it regardless of apparent author.
- `.worktrees/` may contain stale local checkouts unrelated to any PR — never a
  review target, ignore it if `Grep`/`Read` wander into it.
