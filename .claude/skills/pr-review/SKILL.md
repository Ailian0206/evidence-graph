---
name: pr-review
description: 用于独立审核刚创建或更新的 PR，并维护当前 head SHA 的审核 marker 和标签。
---

# PR 独立只读审核

本 skill 始终承担必需的独立审核职责；Cursor Bugbot 可用时只提供附加审核。它只发现和报告问题，代码修复由 Codex 完成；Cursor Autofix 只处理 Bugbot 自己发现的问题。

## 调用模式

支持以下调用：

```text
/pr-review
/pr-review --recheck <PR编号>
/pr-review --trusted-base <PR编号>
/pr-review --trusted-base <PR编号> --recheck
```

- 普通模式：从当前 PR 分支工作区审核该分支对应的一个开放 PR。
- 可信基线模式：从目标 PR 的准确 `baseRefOid` detached worktree 审核涉及审核协议的 PR。
- `--recheck`：仅在 Codex 已对当前 SHA 的 finding 发布结构化技术回复时，允许同 SHA 重新审核。

## 代码只读硬边界

允许：

- 使用 `gh pr view/diff`、`gh api`、Read、Grep、`codegraph_*` 读取信息。
- 运行不会修改仓库的验证命令或临时脚本。
- 发布 PR inline/summary 评论和维护审核标签。

禁止：

- 编辑或写入 tracked 文件。
- commit、push、创建分支、创建/关闭/合并 PR。
- checkout 目标 PR head。
- 在可信基线模式执行、复制或导入目标分支代码。
- 直接修复 finding。

## 审核状态协议

每条 summary 评论必须以机器可读 verdict 和当前 PR head SHA marker 结尾：

```html
<!-- CLAUDE_REVIEW_VERDICT: approved|changes-requested -->
<!-- CLAUDE_REVIEWED_SHA: <head-sha> -->
```

标签语义：

- `claude-reviewed`：当前 head SHA 的审核已完成。
- `claude-changes-requested`：当前审核存在未解决的 CRITICAL/HIGH finding。

如果最新 marker SHA 等于当前 head SHA 且不是 `--recheck`：

1. 读取同一条 summary 的 `CLAUDE_REVIEW_VERDICT`。
2. verdict 为 `approved` 时确保存在 `claude-reviewed` 并移除 `claude-changes-requested`。
3. verdict 为 `changes-requested` 时确保两个标签都存在。
4. 标签已经一致时零写入退出；标签不一致时只修复标签，不发布重复评论。
5. 旧 summary 没有 verdict 时不能推断结果，必须重新执行共同审核过程并发布新格式 summary。

新 head SHA 必须重新审核。只有审核器可以维护两个 Claude 标签。

`--recheck` 只允许在 PR 评论中存在匹配当前 head SHA 的以下 marker 时执行：

```html
<!-- CODEX_REVIEW_RESPONSE_SHA: <head-sha> -->
```

该回复必须列出 finding 链接、Codex 判定和可复现证据。marker 缺失时零 GitHub 写入退出；存在时必须重新读取代码、finding 和回复，发布一条新的同 SHA summary，并按新 verdict 更新标签。

## 审核协议路径

任一变更命中以下路径，就必须使用可信基线模式：

- `.claude/skills/pr-review/**`
- `.cursor/rules/pr-review-gate.mdc`
- `AGENT.md` 中的 PR 审核/合并门禁
- `docs/bugbot-autofix-workflow.md` 中的审核协议
- `docs/superpowers/specs/*pr-review*`
- `docs/superpowers/plans/*pr-review*`

普通模式发现这些路径时必须零 GitHub 写入退出，并要求开发 agent 从准确 `baseRefOid` worktree 运行：

```bash
claude --permission-mode auto --model sonnet -p "/pr-review --trusted-base <PR编号>"
```

## 普通模式

1. 当前必须是命名分支，不能是 detached HEAD。
2. 查询当前分支对应的 PR：

   ```bash
   gh pr view --json number,state,headRefName,headRefOid,baseRefOid,title,isDraft,url
   ```

3. PR 必须是 `OPEN`，当前分支名必须等于 `headRefName`，`git rev-parse HEAD` 必须等于 `headRefOid`，且 base/head SHA 必须存在并不同；使用 `--recheck` 时，参数中的 PR 编号还必须等于查询结果的 `number`。
4. 任一校验失败时零 GitHub 写入退出，不得改为遍历其它开放 PR。
5. 读取变更文件列表；命中审核协议路径时退出，不得评论或加标签。
6. 读取 issue 评论和标签，按“审核状态协议”处理幂等、标签自愈或 `--recheck`。
7. 其余情况进入“共同审核过程”。

## 可信基线模式

只允许指定一个 PR。开始审核前按顺序验证：

1. 参数包含有效正整数 PR 编号。
2. 读取目标状态：

   ```bash
   gh pr view <PR编号> --json state,baseRefOid,headRefOid,title,isDraft,url
   ```

3. `state` 必须是 `OPEN`。
4. `baseRefOid` 和 `headRefOid` 必须存在且不同。
5. 当前 HEAD 必须等于 `baseRefOid`：

   ```bash
   test "$(git rev-parse HEAD)" = "<baseRefOid>"
   ```

6. 当前必须是 detached HEAD；`git symbolic-ref -q HEAD` 成功表示校验失败。
7. 任一校验失败时输出稳定原因并立即退出；不得发布评论或修改标签。
8. 读取 issue 评论和标签，按“审核状态协议”处理幂等、标签自愈或 `--recheck`。

可信基线模式读取目标内容时只能使用：

- `gh pr diff <PR编号>` 获取完整 patch。
- `gh api repos/{owner}/{repo}/contents/{path}?ref=<headRefOid>` 获取目标 head 的完整文件。
- `gh api` 读取评论、review 和 metadata。
- 当前 base worktree 中未被修改的基线上下文。

不得 checkout、fetch 到工作区、执行目标分支测试或从目标分支加载 skill。需要验证库行为时，只能在 base worktree 运行与目标代码无关的临时只读脚本。

## 共同审核过程

1. 完整读取 `gh pr diff <PR编号>`。
2. 对 schema、共享工具、ownership/auth、成本、引文等高风险文件读取完整文件；普通模式可读已验证匹配 head SHA 的工作区文件，可信基线模式必须用 GitHub Contents API 读取目标 head。
3. 不确定库行为时先做只读实证，禁止凭记忆报告。
4. 按以下等级输出：

   | 等级 | 含义 | 合并影响 |
   | --- | --- | --- |
   | CRITICAL | 安全漏洞或数据丢失风险 | 阻塞 |
   | HIGH | 明确 bug 或重大质量问题 | 阻塞 |
   | MEDIUM | 可维护性或非阻塞质量问题 | 自动判断 |
   | LOW | 样式、小风险或记录项 | 可选 |

5. 必查类别：密钥、注入、ownership 绕过、静默吞错、无界查询、缺失行为测试、真实 Provider 调用，以及本项目的 evidence/citation 完整性。
6. 可精确定位的 finding 使用 inline 评论；每个问题一条。评论包含错误、可复现场景和修复方向，不提供完整 diff。
7. 始终发布一条 summary，列出全部 finding、最终结论、准确 verdict marker 和 SHA marker。
8. 如果仓库缺少审核标签，可创建缺少的标签；不得改变已有标签的颜色或说明。
9. 审核完成后添加 `claude-reviewed`。有 CRITICAL/HIGH 时添加 `claude-changes-requested`；后续干净审核必须移除它。
10. 立即退出，不等待开发 agent。

## 项目约束

- Draft PR 也必须审核。
- GitHub 作者身份不能区分 Codex、Cursor 或用户，所有待审核 PR 都按相同规则处理。
- 忽略 `.worktrees/` 中与目标 PR 无关的历史 checkout。
- PR #6 是用户批准的唯一一次流程 bootstrap，因为它的 base 分支尚无可信基线 reviewer；该 PR 不运行审核器。PR #6 合并后，审核协议 PR 不再有人工例外，必须由可信基线模式完成。
