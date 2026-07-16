# Evidence Graph 项目状态

更新时间：2026-07-16

## 当前阶段

- 阶段：证据工作台开发中。
- 分支：`feat/evidence-workspace`。
- PR：[#10](https://github.com/Ailian0206/evidence-graph/pull/10) 已通过独立 Claude 审核和 GitHub CI，并以 merge commit `eee88c2` 合并。
- 当前任务：按中文实施计划开发 Claim 列表、图谱、来源查看器、审核动作、Run Log 和响应式交互。
- 外部 Provider 调用：已禁用。
- 生产部署：未配置。
- Node.js：本地和 CI 使用 `v22.22.1`。
- Cursor Bugbot：本月额度已耗尽，不等待、不重复触发，也不作为当前合并门禁。
- 独立 Claude 审核：由全局 `/codex-independent-pr-review <PR编号>` 执行，不在仓库维护第二套同名 reviewer。

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
| 全自动 PR 审核 | 已完成 | PR [#6](https://github.com/Ailian0206/evidence-graph/pull/6)、[#8](https://github.com/Ailian0206/evidence-graph/pull/8) 和 [#10](https://github.com/Ailian0206/evidence-graph/pull/10) 已合并；当前进程串行完成 PR 闭环 |
| Source hash 项目隔离 | 已完成 | PR [#7](https://github.com/Ailian0206/evidence-graph/pull/7) 已通过 merge commit `8bc6f39` 合并 |
| 证据工作台 | 开发中 | 桌面三栏、移动端标签页和图谱交互测试通过后才创建唯一 Draft PR |
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
- PR #6 本地完整门禁和 GitHub CI 通过后已合并；后续在 PR #8 将流程收敛为单一独立 Claude reviewer。
- Source hash 修复分支基线聚焦测试：`tests/unit/research-domain.test.ts` 23 个测试通过。
- Source hash RED：跨 owner/project 相同 `contentHash` 在 repository 初始化时抛出 `SOURCE_ALREADY_EXISTS`。
- Source hash GREEN：聚焦测试 25 个通过；不同 owner/project 可保存相同内容，同一项目仍拒绝重复哈希。
- Source hash 完整门禁：lint、typecheck、67 个单元测试、build 和 18 个 E2E 测试通过。
- PR #7 独立 Claude 审核和 GitHub CI 通过后已合并；合并后的聚焦测试 25 个通过。
- PR #8 已通过独立 Claude 审核和 GitHub CI 后合并，只保留唯一命名的全局 Claude skill 和审核、修复、重审、合并流程。
- PR #9 已通过独立 Claude 审核和 GitHub CI，并以 merge commit `2108ea0` 合并；MCP Guardian 已加入作品集 Work 页。
- PR #10 独立 Claude 审核结果为 `pass`，GitHub CI 通过 67 个单元测试和 18 个 E2E 测试后，以 merge commit `eee88c2` 合并。

## 下一步

1. 按 TDD 建立工作台视图模型和确定性 Fixture。
2. 完成桌面三栏、移动端标签、Claim 审核、图谱联动、来源查看和 Run Log。
3. 完整门禁和三视口验证通过后创建唯一 Draft PR。
