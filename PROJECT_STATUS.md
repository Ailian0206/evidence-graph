# Evidence Graph 项目状态

更新时间：2026-07-24

## 当前阶段

- 当前里程碑：C1“本地真实研究运行环境”，正在分支 `feat/c1-local-live-research` 实现。
- 当前进度：托管双 profile 启动器、GitHub OAuth、live 资源限制和 hosted/CI 数据库门禁已实现并通过聚焦测试；正在完成文档与完整环境验证。
- 下一次用户可见结果：C1 全部实现和自动化门禁完成后，用户通过固定本地 URL 一次性验收登录、项目列表、fixture 闭环和低范围中文真实研究。
- 当前禁止：不得提前实现 C2-C6，不得更新 `release`，不得执行 Production 迁移、变量修改、Inngest 同步或部署。
- 路线图：`docs/roadmap.md`。

## 真实完成度

| 维度 | 当前状态 | 说明 |
| --- | --- | --- |
| 代码完成度 | C1 实现已进入验证 | Auth、项目、研究工作流、证据工作台、报告和真实 Provider 已在 `main`；C1 分支已补本地运行与资源门禁 |
| 本地验收度 | 未完成 | C1 完成并创建唯一 Draft PR 后进行一次完整本地验收 |
| 产品完成度 | 未完成 | Settings/删除、Evidence Eval、3 个真实案例和 Release Candidate 尚未完成 |
| Production 状态 | 有可用历史基线，当前冻结 | `release` 是唯一 Production Branch；C6 前不再发布 |

结论：Evidence Graph 不是“已经开发完成”，当前处于本地 MVP 收口阶段。

## 当前环境基线

- 分支：`main` 是日常开发与集成分支；`release` 只用于明确批准的 Production 发布。
- Vercel：Preview 自动部署已关闭。
- 托管开发数据库：当前 Supabase 项目用于 C1-C6 开发；本地不再启动 Supabase Docker。Schema 继续由仓库 4 条迁移和 4 个 pgTAP 文件管理。
- 本地应用：固定目标端口为 `3218`，当前未启动；C1 完成后提供统一验收入口。
- 本地 Inngest：仅在 C1 内部研究验证和最终验收时启动，必须限制为 1 个 worker；当前未启动。
- 本地认证：使用现有 GitHub OAuth 和 loopback redirect，不启用托管 anonymous sign-in。
- 本地 Provider：Live adapters 已实现；C1 真实研究使用 Git 忽略且权限收紧的运行文件，并同时限制来源、正文、embedding 批次和费用。
- 数据库门禁：本地 `test:db:hosted` 只运行 linked pgTAP 与 lint；migration reset 仅在 GitHub Actions 的 `test:db:ci` 执行。
- Node.js：本地和 CI 使用 `v22.22.1`。

## 产品里程碑

| 里程碑 | 状态 | 完成门禁 |
| --- | --- | --- |
| C0 规划重置与真实进度基线 | 已完成 | Roadmap、执行流程、状态口径和流程复盘一致，文档验证通过 |
| C1 本地真实研究运行环境 | 进行中 | 用户在本地完成一条低范围中文真实研究 |
| C2 核心研究闭环与缺陷收敛 | 尚未开始 | 已确认的 P0/P1 清单关闭，用户复验通过 |
| C3 Settings 与账号/数据生命周期 | 尚未开始 | 本地语言、项目删除和测试账号删除验收通过 |
| C4 Evidence Eval | 尚未开始 | 10 题评测达到产品计划门槛并经用户抽查 |
| C5 真实案例与作品集回填 | 尚未开始 | 3 个真实案例和作品集页面本地验收通过 |
| C6 本地 Release Candidate | 尚未开始 | 固定候选提交通过完整门禁和用户 walkthrough |
| R1 Production Beta | 冻结 | 只有 C6 完成并获用户明确发布授权后执行 |

## 已交付技术基线

| 模块 | 状态 | 结果 |
| --- | --- | --- |
| 仓库、双语作品集与设计基线 | 已合并 | PR #1 |
| 研究领域与确定性工作流 | 已合并 | PR #3、#4 |
| Source hash 项目隔离 | 已合并 | PR #7 |
| 证据工作台 | 已合并 | PR #11 |
| Supabase Auth/RLS、Inngest、Sentry 与托管边界 | 已合并 | PR #13 |
| 持久化研究结果 | 已合并 | PR #14 |
| 报告发布 | 已合并 | PR #15 |
| 全局 UI 体验优化 | 已合并 | PR #16 |
| Tavily、DeepSeek、百炼真实 Provider | 已合并 | PR #17 |

这些记录只证明技术模块通过当时门禁，不等于当前产品已经完成本地用户验收。

## 最近验证基线

- C1 聚焦测试已通过：本地启动器 13 项、hosted OAuth 7 项、Provider/workflow/Inngest 133 项、数据库门禁组合 16 项。
- C1 改动已分别通过相关 lint 和全仓 typecheck；完整 `test:managed`、fixture/live UI 和真实研究尚待执行。
- 常规单元、E2E 和工程测试禁用付费 Provider；`test:managed` 的数据库部分连接托管开发库并在 pgTAP 事务中回滚。
- 真实 Provider 已通过 Tavily、DeepSeek 和百炼的专用低成本 smoke；日常测试不会外呼。
- Production 曾完成一条低范围中文真实研究和完成态重放验证。这是已存在部署的技术证据，不替代 C1-C6 的本地产品验收。

## 已知 MVP 缺口

- 本地完整运行与真实研究验收。
- 核心研究闭环的用户验收和 P0/P1 缺陷收敛。
- `/app/settings`、语言偏好、项目数据删除和账号删除。
- 10 个固定问题及人工样本的 Evidence Eval。
- 3 个真实公开案例、案例文章、决策图和作品集回填。
- 干净环境的本地 Release Candidate 验收。

支付、团队、导出、定时研究、浏览器扩展、OCR、自托管模型和通用聊天不属于当前 MVP 收口范围。

## 下一步

完成托管环境 check、linked 数据库门禁、fixture/live UI 闭环和完整 `test:managed`。全部通过后只创建一个 Draft PR，再提供固定本地 URL 供用户一次性验收；验收前不合并、不进入 C2。
