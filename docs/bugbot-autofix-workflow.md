# Cursor Bugbot、Autofix 与 Claude 自动审核流程

## 目标

- 一个完整模块只创建一个 PR，避免为中间任务重复支付 Bugbot 审核成本。
- 同一个问题同一时间只有一个修复方，避免 Cursor Autofix 和 Codex 重复实现。
- 远端 CI、Bugbot、Autofix 或 Claude 审核运行时，主进程继续不冲突的本地开发。
- 审核、修复、复审和合并全自动执行，不设置人工审核步骤。

## 角色与所有权

| 角色 | 职责 | 写入权限 |
| --- | --- | --- |
| Cursor Bugbot | 审核当前模块 PR head 并报告问题；可用时属于附加审核 | 只读审核 |
| Cursor Autofix | 优先修复 Bugbot 自己发现的问题 | 可写入 Cursor 分支或模块分支 |
| 独立 Claude reviewer | 运行 `pr-review`，发布 inline/summary 评论并维护 Claude 审核标签 | 只能写 PR 评论和标签，不能改代码、提交、推送或合并 |
| 监控子代理 | 观察 PR、CI、审核标签、marker、Autofix 和远端提交状态 | 完全只读 |
| Codex 主进程 | 继续本地开发，验证审核问题，接管有效修复，执行复审和自动合并 | Autofix 活跃时不得修改其正在处理的同一问题 |

## 状态机

### 1. 本地完成模块

- 在模块分支使用小粒度中文 Conventional Commits。
- 不为单个任务、审核清理、文档检查点或未完成模块创建 PR。
- 完成模块计划并通过完整本地门禁后，只创建一个 Draft PR。

### 2. 创建一个模块 Draft PR

- 推送完整模块分支并创建一个 Draft PR。
- 记录 PR 编号、`baseRefOid` 和当前 `headRefOid`。
- 根据第 7 节立即启动独立 Claude 审核。
- CI 或远端审核运行时启动一个只读监控子代理；Codex 主进程立即在独立分支/worktree 继续下一个不冲突任务。

### 3. Bugbot 与 Autofix 可用时

- Bugbot 只做附加审核，不替代 Claude 必需门禁。
- 从 Bugbot 为某个问题启动 Autofix 起，该问题及直接涉及的代码归 Autofix 独占。
- Autofix 活跃期间，Codex 和其它 agent 不得修复、推送、评论或再次触发同一问题。
- Autofix 发布提交/补丁、报告终止失败、因额度/服务不可用，或者用户明确停止等待时，独占权结束。
- Bugbot 额度耗尽时不等待、不重复触发，直接继续 Claude 审核和本地开发。

### 4. 审核 Autofix 输出

监控子代理只报告新提交或分支，不负责整合。Codex 主进程随后：

1. 拉取远端状态并确认 Autofix 的 base/head SHA。
2. 检查完整 Autofix 差异，把每处改动映射到对应 Bugbot 问题。
3. 为每个问题运行最小聚焦回归测试。
4. 合并前运行完整模块门禁。

如果 Autofix 直接提交到模块分支，验证通过后保留该提交。如果 Autofix 使用 Cursor 分支或独立 PR，通过 merge commit 整合回现有模块分支；不得为 Codex 整合再开一个 PR。

### 5. 处理错误或不完整的 Autofix

- Autofix 独占结束后，Codex 可以接管仍然有效的问题。
- 行为变更先写失败测试复现，再实现最小修复并提交到同一模块分支。
- 同一审核轮次的相关修复集中验证后推送一次，更新现有模块 PR；不得另开 PR。
- 不改写或 force push Cursor 提交。

### 6. Claude finding 自动修复

- `claude-changes-requested` 表示当前 head 存在未解决的 CRITICAL/HIGH 问题，禁止合并。
- Codex 先用代码、测试或可复现命令验证 finding，不盲目接受审核意见。
- 有效问题在原模块分支按 TDD 修复，跑聚焦测试和完整门禁后集中提交、推送。
- push 改变 head SHA 后，旧 marker 自动失效，必须重新运行 Claude 审核。
- 无效 finding 由 Codex 发布结构化技术回复，包含 finding 链接、判定、可复现证据和 `CODEX_REVIEW_RESPONSE_SHA` marker，然后触发对应审核模式的 `--recheck`。Claude 标签只能由 reviewer 更新，Codex 不手工操作。
- MEDIUM/LOW finding 不自动阻塞，由 Codex 技术核验后决定是否同批修复。

### 7. 独立 Claude 审核

#### 普通模式

不涉及审核协议的 PR，从当前 PR 分支工作区根目录运行。reviewer 必须验证当前分支和 HEAD 分别等于 PR 的 `headRefName` 与 `headRefOid`，只审核这一个 PR，不能遍历其它开放 PR：

```bash
claude --permission-mode auto --model sonnet -p "/pr-review"
```

#### 可信基线模式

任一变更触及以下路径时，PR 不得使用正在修改的 reviewer 给自己认证：

- `.claude/skills/pr-review/**`
- `.cursor/rules/pr-review-gate.mdc`
- `AGENT.md` 中的审核/合并门禁
- 本文档中的审核协议
- `docs/superpowers/specs/*pr-review*`
- `docs/superpowers/plans/*pr-review*`

必须从 PR 的准确 `baseRefOid` 创建临时 detached worktree，并从该目录运行：

```bash
claude --permission-mode auto --model sonnet -p "/pr-review --trusted-base <PR编号>"
```

reviewer 只能通过 `gh pr diff` 和 GitHub API 读取目标 PR，不能 checkout 或执行目标分支代码。审核结束后确认临时 worktree 没有改动，再正常移除；禁止使用 `--force` 清理包含改动的 worktree。

PR #6 是用户批准的唯一一次流程引导，因为它的 base 分支还没有可信基线 reviewer。PR #6 合并后不再允许人工审核例外，所有协议 PR 都必须使用可信基线模式。

#### 审核终态

每条 summary 评论以机器可读 verdict 和当前 PR head SHA 结尾：

```html
<!-- CLAUDE_REVIEW_VERDICT: approved|changes-requested -->
<!-- CLAUDE_REVIEWED_SHA: <head-sha> -->
```

只有同时满足以下条件才算审核通过：

- 存在 `claude-reviewed`。
- 不存在 `claude-changes-requested`。
- 最新 `CLAUDE_REVIEWED_SHA` 等于当前 `headRefOid`。

marker 匹配当前 SHA 但标签缺失或与 verdict 冲突时，reviewer 只按 summary verdict 修复标签，不发布重复 summary。旧 summary 没有 verdict 时重新完整审核。

Codex 判定阻塞 finding 无效且代码无需变化时，发布包含当前 SHA 的结构化回复，然后运行：

```bash
claude --permission-mode auto --model sonnet -p "/pr-review --recheck <PR编号>"
```

协议 PR 则从可信基线 worktree 运行 `/pr-review --trusted-base <PR编号> --recheck`。reviewer 必须重新读取 finding、代码和技术证据，发布新的同 SHA verdict，并自动维护标签。

marker 缺失或 SHA 过期表示审核未完成。Claude 非零退出时检查认证和输出并自动重试一次；第二次仍失败则保持 PR 未审核，主进程继续其它不冲突任务，但不得合并。

### 8. 自动合并

满足以下全部条件后，Codex 无需人工批准，直接将 Draft PR 标记为 Ready 并使用 merge commit 合并：

1. 本地完整门禁通过。
2. GitHub CI 通过。
3. Claude marker 匹配当前 head SHA。
4. 存在 `claude-reviewed` 且不存在 `claude-changes-requested`。
5. 没有未解决的有效 CRITICAL/HIGH 问题。
6. 当前没有 Autofix 正在处理同一 PR 的阻塞问题。

```bash
gh pr ready <PR编号>
gh pr merge <PR编号> --merge --delete-branch
```

禁止 squash、rebase 和 force push。Bugbot 的额度跳过表示少了一项附加审核，不属于代码问题，也不阻塞已经通过 Claude 与 CI 门禁的合并。

## 监控子代理约束

监控子代理严格只读。它可以使用 `gh pr view`、`gh pr checks`、`gh api`、`git fetch` 和远端日志/差异命令，但不得编辑文件、创建提交、推送、发布评论、改标签、触发 Autofix 或合并。

每次报告必须包含：

- PR 编号和当前 head SHA。
- CI 与 Bugbot 检查结论。
- 最新 Claude marker SHA 和审核标签是否对应当前 head。
- Bugbot 审核 SHA，以及 Autofix 是活跃、完成、失败还是缺失。
- 上次观察后出现的 Cursor 提交或分支 SHA。
- 尚未解决的问题和建议的下一状态。

每个活动审核最多一个监控子代理。达到终态或可操作状态后结束该子代理；只有 PR head 或检查状态发生有效变化后才启动新的监控。Bugbot 不可用时不为它单独监控，但 Claude/CI 活跃时仍可使用监控子代理。

## PR 成本控制

- 一个模块只创建一个 Draft PR。
- 本地可以有多个逻辑提交；PR 创建才是主要成本边界。
- Bugbot 审核或 Autofix 活跃时避免非必要 push。
- Codex 后续修复在每轮审核中完成验证后集中 push 到原 PR。
- 等待远端自动化永远不阻塞其它不冲突的本地模块工作。
