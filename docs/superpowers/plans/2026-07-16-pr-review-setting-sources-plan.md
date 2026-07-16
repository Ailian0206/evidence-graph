# Claude reviewer 配置源隔离修复计划

## 目标

所有 PR reviewer 调用都只加载当前仓库的 project/local 配置，避免 `~/.claude/skills/` 中其它项目的同名 `pr-review` skill 覆盖仓库审核协议。

## 已确认的 RED

PR #7 首次执行：

```bash
claude --permission-mode auto --model sonnet -p "/pr-review"
```

Claude CLI 实际加载了用户级 `~/.claude/skills/pr-review/SKILL.md`，发布的 summary 缺少仓库协议要求的 `CLAUDE_REVIEW_VERDICT`，重复执行仍按旧幂等规则跳过。

## 已确认的 GREEN

同一 PR、同一 head SHA 改用：

```bash
claude --setting-sources project,local --permission-mode auto --model sonnet -p "/pr-review"
```

reviewer 正确加载仓库 `.claude/skills/pr-review/SKILL.md`，重新完整审核并发布 `CLAUDE_REVIEW_VERDICT: approved` 和匹配当前 head 的 `CLAUDE_REVIEWED_SHA`。

## 实施步骤

1. 把 `AGENT.md`、Cursor 规则、Claude skill 提示命令和审核工作流中的所有 reviewer 命令改为显式 `--setting-sources project,local`。
2. 同步更新可信基线设计与实施计划中的命令，避免后续 agent 复制旧调用。
3. 更新 `PROJECT_STATUS.md`，记录 PR #7 已合并以及本次协议修复状态。
4. 静态扫描仓库和 Codex 全局 skill，确认活动流程不再保留未限定配置源的 reviewer 命令。
5. 运行完整本地门禁，创建一个 Draft PR。
6. 因本 PR 修改审核协议，从准确 `baseRefOid` detached worktree 使用可信基线模式审核。
7. CI、当前 SHA marker、verdict 和标签全部通过后自动 merge commit。

## 完成标准

- 普通、可信基线和 `--recheck` 调用都限定为 `project,local`。
- 用户级同名 skill 不再影响 Evidence Graph reviewer。
- Codex、Cursor、Claude 和项目文档中的命令一致。
- 本地门禁、可信基线审核和 GitHub CI 通过。
