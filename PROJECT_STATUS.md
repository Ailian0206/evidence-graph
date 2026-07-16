# Evidence Graph 项目状态

更新时间：2026-07-16

## 当前阶段

- 阶段：Claude reviewer 配置源隔离已在本地完成，准备可信基线审核。
- 分支：`fix/pr-review-project-sources`。
- PR：尚未创建；完整门禁通过后创建一个协议修复 Draft PR。
- 当前任务：创建一个协议修复 Draft PR，并运行可信基线审核。
- 外部 Provider 调用：已禁用。
- 生产部署：未配置。
- Node.js：本地和 CI 使用 `v22.22.1`。
- Cursor Bugbot：本月额度已耗尽，不等待、不重复触发，也不作为当前合并门禁。
- 独立 Claude 审核：PR #6 已完成唯一一次流程引导；后续所有 PR 都必须自动审核，协议 PR 使用可信基线模式。

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
| 全自动 PR 审核 | 已完成 | PR [#6](https://github.com/Ailian0206/evidence-graph/pull/6) 已通过 merge commit `c1daf16` 合并 |
| Source hash 项目隔离 | 已完成 | PR [#7](https://github.com/Ailian0206/evidence-graph/pull/7) 已通过 merge commit `8bc6f39` 合并 |
| Reviewer 配置源隔离 | 本地完成 | 命令一致性扫描和完整门禁通过；等待 Draft PR、可信基线审核和 CI |
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
- PR #6 本地完整门禁和 GitHub CI 通过后已合并；全自动普通/可信基线 Claude 审核流程现已生效。
- Source hash 修复分支基线聚焦测试：`tests/unit/research-domain.test.ts` 23 个测试通过。
- Source hash RED：跨 owner/project 相同 `contentHash` 在 repository 初始化时抛出 `SOURCE_ALREADY_EXISTS`。
- Source hash GREEN：聚焦测试 25 个通过；不同 owner/project 可保存相同内容，同一项目仍拒绝重复哈希。
- Source hash 完整门禁：lint、typecheck、67 个单元测试、build 和 18 个 E2E 测试通过。
- PR #7 独立 Claude 审核和 GitHub CI 通过后已合并；合并后的聚焦测试 25 个通过。
- Reviewer 配置源 RED：默认 Claude 调用加载用户级旧 skill，summary 缺少 `CLAUDE_REVIEW_VERDICT`。
- Reviewer 配置源 GREEN：限制 `project,local` 后加载仓库 skill，并发布完整 verdict 和 SHA marker。
- Reviewer 配置源完整门禁：lint、typecheck、67 个单元测试、build 和 18 个 E2E 测试通过。

## 下一步

1. 提交 reviewer 配置源隔离修复并创建一个 Draft PR。
2. 使用可信基线模式审核。
3. 审核和 CI 通过后 merge commit 合并。
