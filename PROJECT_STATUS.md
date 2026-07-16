# Evidence Graph 项目状态

更新时间：2026-07-16

## 当前阶段

- 阶段：建立全自动 PR 审核门禁，并准备修复来源哈希的项目隔离问题。
- 分支：`chore/pr-review-skill-setup`。
- PR：[#6](https://github.com/Ailian0206/evidence-graph/pull/6) 正在补齐可信基线审核流程；当前分支验证完成后合并。
- 当前任务：完成 PR #6，然后由 Codex 从最新 `main` 重新实现 source hash 项目隔离修复。
- 外部 Provider 调用：已禁用。
- 生产部署：未配置。
- Node.js：本地和 CI 使用 `v22.22.1`。
- Cursor Bugbot：本月额度已耗尽，不等待、不重复触发，也不作为当前合并门禁。
- 独立 Claude 审核：PR #6 是用户批准的唯一一次流程引导；合并后所有 PR 都必须自动审核，协议 PR 使用可信基线模式。

## 已确认的身份与作品集内容

- 品牌：Ailian。
- 定位：从高级前端工程师扩展到全栈和 Agent 工程。
- 联系方式：`airenglian@gmail.com`。
- GitHub：`Ailian0206`。
- 公开项目：Evidence Graph 和 AI Photo Studio CN。

## 里程碑

| 模块 | 状态 | 完成门禁 |
| --- | --- | --- |
| 仓库基线 | 已完成 | 计划、流程文档、GitHub 远端和干净 `main` |
| 基础与作品集 | 已完成 | PR [#1](https://github.com/Ailian0206/evidence-graph/pull/1) 在 CI、Codex 审核和视觉验证通过后合并 |
| 研究领域基础 | 已完成 | PR [#3](https://github.com/Ailian0206/evidence-graph/pull/3) 已合并为 `3fef13c` |
| 确定性研究工作流 | 已完成 | PR [#4](https://github.com/Ailian0206/evidence-graph/pull/4) 已通过 merge commit `2c8b90d` 合并 |
| 全自动 PR 审核 | 进行中 | PR [#6](https://github.com/Ailian0206/evidence-graph/pull/6) 建立普通/可信基线 Claude 审核、自动修复和自动合并流程 |
| Source hash 项目隔离 | 待重新实现 | 已关闭 PR [#5](https://github.com/Ailian0206/evidence-graph/pull/5)；有效问题由 Codex 在新分支按 TDD 重做，不复用作废提交 |
| 证据工作台 | 待开始 | 桌面三栏、移动端标签页和图谱交互测试通过 |
| 托管部署 | 待开始 | 获得账号授权后完成 Supabase、Inngest、Vercel 配置和生产冒烟测试 |

## 验证摘要

- 研究领域模块 `npm run test:ci`：PR #3 合并前通过 27 个单元测试和 18 个 E2E 测试。
- 研究工作流聚焦测试 `tests/unit/research-workflow.test.ts`：最终修复后通过 38 个测试。
- 研究工作流 `npm run test:ci`：最终修复后通过 lint、typecheck、65 个单元测试、build 和 18 个 E2E 测试。
- 视觉截图覆盖 390x844、1024x768 和 1440x1000。
- 路由截图覆盖 `/zh`、`/en`、`/zh/work`、`/zh/evidence`、`/zh/notes` 和案例详情页。
- Provider 安全扫描未发现凭据、真实 OpenAI/Tavily 端点、网络 Provider 实现或 Provider SDK 依赖。
- 本地 shell 必须使用 Node 22；Node 16 因缺少 `structuredClone` 无法运行 ESLint。
- 研究领域和研究工作流的最终审核没有未解决的 Critical 或 Important 问题。
- PR #5 已关闭，其 reviewer 越权提交 `d0d297d` 明确作废；不得 cherry-pick。问题本身有效：`contentHash` 目前跨项目全局唯一，会阻止不同用户保存同一公开内容，并形成跨租户探测信道。

## 下一步

1. 完成 PR #6 的中文流程文档和完整门禁，推送后等待 CI，并使用用户已批准的一次性引导例外通过 merge commit 合并。
2. 从更新后的 `main` 创建 `fix/source-hash-project-scope-v2` worktree。
3. 先用失败测试复现跨项目相同 `contentHash` 冲突，再实现项目内唯一约束。
4. 完整门禁通过后创建一个 Draft PR，运行新的全自动 Claude 审核流程，并在审核和 CI 通过后自动合并。
