# PR 自动审核流程

## 核心原则

- 一个完整模块只创建一个 PR。
- Codex 负责开发和修复，独立 Claude Code 负责审核，避免同一个模型审核自己写的代码。
- 审核、修复、复审和合并不需要人工参与。

## 执行流程

### 1. 完成本地开发

- 在模块分支完成目标和完整本地门禁。
- 中间任务不创建 PR。
- 模块完成后只创建一个 Draft PR。

### 2. Claude Code 独立审核

创建或更新 PR 后运行：

```bash
claude --permission-mode auto --model sonnet -p "/codex-independent-pr-review <PR编号>"
```

Claude Code 只读取 PR 并发布评论，禁止修改代码、commit、push 或合并。

### 3. 处理审核结果

- `changes_requested`：Codex 读取评论并验证问题，在原分支修复、测试、提交和 push，然后重新运行 Claude 审核。
- `pass`：确认审核 summary 对应当前 PR head SHA，再等待 CI。
- push 改变 head SHA 后，必须重新审核。
- 修复始终留在原 PR，不再创建新 PR。

### 4. 自动合并

Claude 对当前 head 返回 `pass` 且 GitHub CI 通过后，Codex 直接使用 merge commit 合并：

```bash
gh pr ready <PR编号>
gh pr merge <PR编号> --merge --delete-branch
```

禁止 squash、rebase 和 force push。

## Bugbot 与 Autofix

- Cursor Bugbot 可用时只做附加审核，不替代 Claude Code。
- Autofix 正在处理某个 Bugbot finding 时，该问题由 Autofix 负责，Codex 不重复修复。
- Autofix 完成后，Codex 检查差异并运行测试；有问题就在原 PR 继续修复。
- Bugbot 额度耗尽或服务不可用时不等待，继续 Claude 审核流程。

## 并行执行

Claude 审核和 CI 等待可交给一个只读子代理。主进程继续其它不冲突的本地任务，不原地等待。
