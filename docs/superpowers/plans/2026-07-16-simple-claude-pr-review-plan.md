# 独立 Claude PR 审核简化计划

## 目标

Codex 提交 PR 后，由不同模型的 Claude Code 独立审核；有问题就评论并由 Codex 在原 PR 修复，没有问题且 CI 通过就自动合并。

## 实施

1. 使用全局 `/codex-independent-pr-review <PR编号>`，避免仓库和用户目录存在多套同名 reviewer。
2. Claude 只读审核并发布 `pass` 或 `changes_requested` summary，不修改代码。
3. Codex 处理有效评论，测试后直接提交到原 PR，再次触发 Claude。
4. 当前 head 审核通过且 CI 成功后 merge commit。
5. 清理旧的多阶段审核规则和重复 reviewer。
6. PR 创建后由当前进程串行完成审核、修复、重审、CI 和合并，闭环前不开始下一个模块。

## 完成标准

- 流程只有“PR、Claude 审核、Codex 修复、重审、合并”。
- 同一个模型不审核自己写的代码。
- 一个模块只有一个 PR，不包含人工审核步骤。
- 当前 PR 完整闭环前不开始下一个模块。
