# 可信基线 PR 自动审核实施计划

> **供 agent 执行：** 必须使用 `superpowers:executing-plans` 逐项执行。步骤使用 `- [ ]` 跟踪。

**目标：** 把普通 PR 和审核协议 PR 都接入无需人工批准的独立 Claude 审核、自动修复、复审和 merge commit 流程。

**架构：** 普通 PR 继续从当前分支运行 `/pr-review`；任何触及审核协议的 PR 都从 `baseRefOid` 临时 detached worktree 运行基线版本 `/pr-review --trusted-base <PR编号>`。两种模式共享 marker、标签和自动修复状态机。

**技术栈：** Claude Code CLI、Git worktree、GitHub CLI、Markdown skill/rule 文档。

---

## 任务 1：给 Claude reviewer 增加可信基线模式

**文件：**

- 修改：`.claude/skills/pr-review/SKILL.md`

- [x] **步骤 1：记录当前 RED 行为**

从 PR #6 自身工作区运行：

```bash
claude --setting-sources project,local --permission-mode auto --model sonnet -p "/pr-review --trusted-base 6"
```

预期：旧 skill 不识别可信基线模式，只按“协议不能自审”跳过，无法校验当前 HEAD 与 `baseRefOid`。

- [x] **步骤 2：实现参数和安全校验**

在 skill 开头定义两种调用：

```text
/pr-review
/pr-review --trusted-base <PR编号>
```

可信基线模式必须读取 `baseRefOid`、`headRefOid` 和 PR 状态，验证 `git rev-parse HEAD === baseRefOid`，并在任何校验失败时零 GitHub 写入退出。

- [x] **步骤 3：实现目标分支只读读取约束**

可信基线模式只能使用 `gh pr diff`、`gh api` 和 `gh pr view` 读取目标 PR；禁止 checkout、执行或复制目标分支文件。普通模式如果发现变更触及审核协议，应退出并打印可信基线调用要求。

- [x] **步骤 4：验证错误 worktree 被拒绝**

仍从 PR #6 工作区运行步骤 1 命令。

预期：输出明确包含 base SHA 不匹配，PR #6 评论和标签数量不变，本地 `git status` 不变。

- [x] **步骤 5：提交**

```bash
git add .claude/skills/pr-review/SKILL.md
git commit -m "feat: 增加可信基线 PR 审核模式"
```

## 任务 2：更新 Codex、Cursor 和项目自动门禁

**文件：**

- 修改：`/Users/ailian/.codex/skills/pr-review/SKILL.md`
- 修改：`.cursor/rules/pr-review-gate.mdc`
- 修改：`AGENT.md`
- 修改：`docs/bugbot-autofix-workflow.md`
- 修改：`PROJECT_STATUS.md`

- [x] **步骤 1：更新 Codex 全局 skill**

写明路径分类、`baseRefOid` worktree 创建/清理命令、普通/可信基线 Claude 命令、marker 校验、标签处理和一次自动重试。允许只读子代理运行 Claude，使主进程继续不冲突工作。

- [x] **步骤 2：更新仓库规则**

删除“审核协议 PR 人工看一眼”的例外。改为：只要变更触及 `.claude/skills/pr-review/`、`.cursor/rules/pr-review-gate.mdc`、`AGENT.md` 的审核门禁或 `docs/bugbot-autofix-workflow.md` 的审核协议，就必须使用可信基线模式。

- [x] **步骤 3：更新项目状态**

记录 PR #4 已合并、PR #6 正在建立全自动审核，以及下一步是合并 PR #6 后由开发 agent 重新实现 source hash 隔离修复。

- [x] **步骤 4：静态验证规则一致性**

```bash
rg -n "人工|trusted-base|可信基线|claude-changes-requested|CLAUDE_REVIEWED_SHA" \
  /Users/ailian/.codex/skills/pr-review/SKILL.md \
  .claude/skills/pr-review/SKILL.md \
  .cursor/rules/pr-review-gate.mdc AGENT.md docs/bugbot-autofix-workflow.md
```

预期：不存在协议 PR 依赖人工审核的有效规则；两种模式和阻塞标签语义一致。

- [x] **步骤 4.1：修复规格复核发现的状态机缺口**

普通模式绑定当前 PR 分支和 head SHA；summary 增加机器可读 verdict；同 SHA 标签异常由 reviewer 自动修复；Codex 使用结构化证据回复和 `--recheck` 处理无需改代码的无效 finding；PR #6 一次性引导例外在所有规则中保持一致。

- [x] **步骤 5：提交仓库规则**

```bash
git add .cursor/rules/pr-review-gate.mdc AGENT.md docs/bugbot-autofix-workflow.md PROJECT_STATUS.md
git commit -m "docs: 接入全自动可信基线审核门禁"
```

## 任务 3：验证、更新 PR #6 并合并

**文件：**

- 修改：`docs/superpowers/specs/2026-07-16-trusted-base-pr-review-design.md`
- 创建：`docs/superpowers/plans/2026-07-16-trusted-base-pr-review-plan.md`

- [x] **步骤 1：检查文档和工作区**

```bash
git diff --check
git status --short --branch
```

预期：无空白错误，只有计划内文件。

- [x] **步骤 2：提交中文规格和计划**

```bash
git add docs/superpowers/specs/2026-07-16-trusted-base-pr-review-design.md \
  docs/superpowers/plans/2026-07-16-trusted-base-pr-review-plan.md
git commit -m "docs: 完善可信基线审核中文规格"
```

- [ ] **步骤 3：运行完整项目门禁**

```bash
PATH=/Users/ailian/.nvm/versions/node/v22.22.1/bin:$PATH npm run test:ci
```

预期：lint、typecheck、unit、build 和 Playwright E2E 全部通过，无真实 Provider 调用。

- [ ] **步骤 4：推送并等待 CI**

```bash
git push
gh pr checks 6 --watch --interval 10
```

预期：CI 成功。PR #6 是一次性 bootstrap，使用用户已给出的批准，不要求它用不存在于 base 分支的 reviewer 审核自己。

- [ ] **步骤 5：merge commit 合并**

```bash
gh pr merge 6 --merge --delete-branch
```

预期：PR #6 合并，远端协议分支删除，本地 `main` 快进到 merge commit。

## 任务 4：进入 source hash bugfix

- [ ] **步骤 1：从更新后的 main 创建独立 worktree**

分支名：`fix/source-hash-project-scope-v2`；路径：`.worktrees/source-hash-project-scope-v2`。

- [ ] **步骤 2：在 bugfix worktree 读取项目规则并写独立实施计划**

该计划必须按 RED→GREEN 重新实现跨项目相同 `contentHash` 可共存，不能 cherry-pick 或复用已关闭 PR #5 的 reviewer-authored 提交。
