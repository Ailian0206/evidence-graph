# 来源内容哈希项目隔离修复计划

## 目标

把来源 `contentHash` 的唯一性从跨仓库全局范围收窄到项目范围，使不同 owner 的不同项目可以保存同一公开内容，同时保留同一项目内的来源去重。

## 约束

- 从合并 PR #6 后的最新 `main` 重新实现。
- 不 cherry-pick、不复制、也不依赖已关闭 PR #5 的作废提交。
- 先观察失败测试，再实现最小修复。
- 来源 ID 继续保持全局唯一。
- 同一项目内相同 canonical URL 或相同 `contentHash` 继续抛出 `SOURCE_ALREADY_EXISTS`。
- 不调用真实 OpenAI 或 Tavily Provider。

## 实施步骤

### 1. RED：复现跨项目哈希冲突

修改 `tests/unit/research-domain.test.ts`：

1. 在 fixture 中创建另一个 owner 拥有的项目。
2. 为该项目添加不同 ID、不同 URL，但 body 和 `contentHash` 与现有来源相同的 Source。
3. 初始化 repository，并断言另一个 owner 可以列出该来源。
4. 在同一项目再添加不同 ID、不同 URL 但相同 `contentHash` 的来源，断言仍抛出 `SOURCE_ALREADY_EXISTS`。

运行：

```bash
PATH=/Users/ailian/.nvm/versions/node/v22.22.1/bin:$PATH \
  npm run test:unit -- tests/unit/research-domain.test.ts
```

预期：当前实现先在 repository 初始化阶段抛出 `SOURCE_ALREADY_EXISTS`，证明跨项目冲突存在。

### 2. GREEN：收窄哈希唯一性

修改 `src/features/projects/project-repository.ts`，让 `contentHash` 与 `canonicalUrl` 一样只在 `current.projectId === source.projectId` 时判重；不改变 ID 唯一性和其它 repository 行为。

重新运行聚焦测试，预期全部通过。

### 3. 验证与交付

1. 运行 `git diff --check`。
2. 运行完整 `npm run test:ci`。
3. 更新 `PROJECT_STATUS.md` 并使用中文 Conventional Commit 提交。
4. 模块目标全部完成后只创建一个 Draft PR。
5. 运行 `/codex-independent-pr-review <PR编号>`；有 finding 时由 Codex 在原 PR 修复并重审，无问题且 CI 通过后使用 merge commit 自动合并。

## 完成标准

- 不同 owner/project 可以保存相同内容。
- 同一项目内相同内容仍被拒绝。
- 来源 ID 和 canonical URL 的原有唯一规则不变。
- 聚焦测试和完整项目门禁通过。
- 不产生第二个修复 PR，不复用 PR #5 的作废提交。
