# 可信基线 PR 自动审核设计

## 背景

Evidence Graph 始终使用独立 Claude Code 进程作为 PR 必需审核方，Cursor Bugbot 可用时只提供附加审核。普通 PR 可以加载自身分支中的 `.claude/skills/pr-review/SKILL.md`，因为它没有修改审核器；修改审核协议的 PR 不能使用正在被修改的版本给自己认证。

PR #6 是唯一一次引导建立流程。用户已审核并批准这个引导分支。它合并后，包括审核协议变更在内的所有后续 PR 都必须在没有人工审核门禁的情况下完成。

## 目标

- 每个完整模块或独立 bugfix 只创建一个 PR。
- 审核、修复、复审和合并不依赖人工批准。
- 审核协议 PR 不得加载它正在修改的审核器实现。
- 保留 `CLAUDE_REVIEWED_SHA`、`claude-reviewed` 和 `claude-changes-requested` 协议，并增加机器可读 verdict、标签自愈和同 SHA 技术复审。
- 独立审核运行期间，主开发进程可以继续不冲突的本地任务。

## 不在范围内

- 替代 CI、本地测试或项目专项门禁。
- 允许审核器修改代码、提交、推送、创建 PR 或合并。
- 在 Cursor Bugbot 额度不可用时恢复 Bugbot 或 Autofix。
- 自动批准 `AGENT.md` 已列出的密钥、付费 Provider、生产环境或其它外部写入门禁。

## 信任模型

### 普通 PR

独立 Claude 进程从当前 PR 分支工作区运行 `/pr-review`。reviewer 必须验证工作区分支和 HEAD 与该 PR 的 `headRefName`、`headRefOid` 一致，只审核这一个 PR，再发布 finding、汇总 marker 和审核标签。

### 审核协议 PR

开发 agent 不得从协议 PR 工作区运行审核器。它先取得 PR 的 `baseRefOid`，在该 SHA 创建临时 detached worktree，再从基线版本执行可信基线模式：

```bash
claude --permission-mode auto --model sonnet -p "/pr-review --trusted-base <PR编号>"
```

可信基线模式在审核前必须验证：

1. 指定 PR 仍处于 open 状态。
2. 当前 detached worktree 的 HEAD 等于 PR 的 `baseRefOid`。
3. PR head SHA 与 base SHA 不同。
4. 如果已有审核 marker，其 SHA 与当前 PR head SHA 相等，则按 summary verdict 校验或修复标签；只有带 Codex 结构化证据回复时才允许 `--recheck`。

审核器随后通过 `gh pr diff` 和 GitHub API 读取目标 PR，不 checkout 或执行目标分支文件。因此执行审核的是此前已接受的基线版本，不是本次正在修改的规则。

Claude 退出后删除临时 worktree。清理失败属于需要报告和重试的运行错误，不能把审核视为成功。

## 全自动状态机

1. 开发 agent 在本地完成模块或 bugfix，并跑完整门禁。
2. 推送一个模块分支，创建或更新现有 Draft PR。
3. 记录 PR 编号和当前 head SHA。
4. 根据变更路径选择普通模式或可信基线模式。
5. 启动一个独立 Claude 审核进程；可由只读监控子代理持有该进程，主 agent 继续不冲突工作。
6. 只有 CI 和审核都达到终态后才做合并判断。
7. 出现 `claude-changes-requested` 时，开发 agent 验证每个 CRITICAL/HIGH finding，在同一分支按 TDD 修复有效问题，跑聚焦和完整门禁，批量推送一次后回到步骤 3。
8. 存在 `claude-reviewed`、不存在 `claude-changes-requested`，且 marker SHA 等于 PR head SHA 时，审核门禁通过。标签与同 SHA summary verdict 不一致时 reviewer 自动修复标签；Codex 用结构化证据回复触发 `--recheck`，处理无需改代码的无效 finding。MEDIUM/LOW finding 由开发 agent 自动判断，技术上成立时一并修复。
9. CI 通过且没有未解决的有效阻塞 finding 后，开发 agent 把 PR 标记为 Ready，使用 merge commit 合并并删除远端分支。

整个状态机没有人工审核步骤。只有 `AGENT.md` 已列出的成本和外部写入门禁仍需要用户授权。

## 失败处理

- Claude 非零退出：保持两个审核标签不变，记录输出，检查认证和命令错误后自动重试一次。
- 没有匹配当前 head SHA 的 marker：即使存在 `claude-reviewed` 也视为审核未完成。
- marker SHA 过期：对当前 head 重新触发审核。
- 两个标签都不存在：有同 SHA 新格式 summary 时由 reviewer 按 verdict 自动修复，否则视为审核未完成。
- 新一轮干净审核后仍有 `claude-changes-requested`：由审核器移除，开发 agent 永远不手工移除。
- 可信基线模式校验 base SHA 失败：不发评论、不加标签，按准确 `baseRefOid` 重建 detached worktree。
- CI 失败：在同一分支修复；由于 head SHA 改变，修复后必须重新审核。

## 文件职责

- `~/.codex/skills/pr-review/SKILL.md`：Codex 侧编排、模式选择、基线 worktree 生命周期、审核结果检查和自动修复循环。
- `.claude/skills/pr-review/SKILL.md`：Claude 侧普通/可信基线审核、前置校验、评论、marker 和标签。
- `.cursor/rules/pr-review-gate.mdc`：Cursor 侧自动模式选择和无人工例外约束。
- `AGENT.md`：项目合并门禁和自动审核职责。
- `docs/bugbot-autofix-workflow.md`：长期协作流程和状态迁移。

## 验证场景

1. 协议 PR 从自身工作区运行时必须拒绝自我认证，不发评论、不加标签。
2. 可信基线模式必须拒绝 HEAD 不等于 `baseRefOid` 的 worktree。
3. 可信基线模式从准确 base SHA 审核协议 PR，并写入一个汇总 marker 和正确标签。
4. 对同一 head SHA 重跑时，标签一致则零写入；标签异常时只修复标签，不重复发布 summary。
5. 存在匹配 SHA 的 Codex 技术回复时，`--recheck` 可以发布新的同 SHA verdict 并更新标签。
6. 普通非协议 PR 必须绑定当前分支和 head SHA，只审核该分支对应的一个 PR。
7. 每次审核后仓库工作区都保持不变。

## 交付顺序

1. 在 PR #6 增加可信基线自动化，运行 CI，并使用用户对引导版本的批准通过 merge commit 合并。
2. 从更新后的 `main` 创建开发 agent 自有的 bugfix 分支。
3. 先用失败单测复现跨项目 `contentHash` 冲突，再实现项目内唯一规则并跑完整门禁。
4. 创建一个 Draft bugfix PR，运行新的全自动 Claude 审核，修复有效 finding，CI 和审核通过后自动合并。
