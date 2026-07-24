# Evidence Graph 项目状态

更新时间：2026-07-24

## 当前阶段

- 当前里程碑：C1“本地真实研究运行环境”，正在分支 `feat/c1-local-live-research` 实现。
- 当前进度：C1 实现和内部托管链路验证已完成，已验证实现 head 为 `44971b4`；唯一 Draft PR #18 已从验收候选 head `8b51288` 创建，GitHub CI 正在运行。
- 下一次用户可见结果：启动固定本地 URL 后，用户一次性验收 GitHub 登录、项目列表、fixture 闭环和低范围中文真实研究。
- 当前禁止：不得提前实现 C2-C6，不得更新 `release`，不得执行 Production 迁移、变量修改、Inngest 同步或部署。
- 路线图：`docs/roadmap.md`。

## 真实完成度

| 维度 | 当前状态 | 说明 |
| --- | --- | --- |
| 代码完成度 | C1 验收候选 | 分支 `feat/c1-local-live-research` 的实现 head `44971b4` 已通过内部托管链路和完整自动化门禁；唯一 Draft PR #18 已创建 |
| 本地验收度 | 待用户验收 | fixture 与受限 live 工作流已在本地服务连接托管开发库后达到 `ready`；GitHub OAuth 和完整 UI 点击流程仍待 Draft PR 后验收 |
| 产品完成度 | 未完成 | Settings/删除、Evidence Eval、3 个真实案例和 Release Candidate 尚未完成 |
| Production 状态 | 有可用历史基线，当前冻结 | `release` 是唯一 Production Branch；C6 前不再发布 |

结论：Evidence Graph 不是“已经开发完成”，当前处于本地 MVP 收口阶段。

## 当前环境基线

- 分支：`main` 是日常开发与集成分支；`release` 只用于明确批准的 Production 发布。
- Vercel：Preview 自动部署已关闭。
- 托管开发数据库：当前 Supabase 项目用于 C1-C6 开发；本地不再启动 Supabase Docker。Schema 继续由仓库 4 条迁移和 4 个 pgTAP 文件管理。
- 本地应用：固定目标端口为 `3218`，当前未启动；C1 完成后提供统一验收入口。
- 本地 Inngest：仅在 C1 内部研究验证和最终验收时启动，使用 CLI `1.38.1` 可正常扫描队列的最小值 5 个 worker；当前未启动。
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

- C1 最终聚焦门禁通过：provider 边界检查、7 个测试文件 `180/180` 和全仓 typecheck。
- `test:managed` 通过：托管 pgTAP `93/93`、Schema lint、全仓 lint/typecheck、单元测试 `325/325`、production build 和 E2E `82/82`；例行门禁未调用付费 Provider。
- fixture 工作流连接托管开发库后达到 `ready`，Provider 外呼和费用均为 0；Chrome 扩展自动化通信不可用，因此浏览器点击部分保留给最终用户验收。
- 受限 live 工作流达到 `ready`：4 个来源、35,331 个正文字符、35 个 chunks、4 个 embedding 批次、3 次搜索、61,196 tokens、11 条 Claims、7 条 Evidence links 和 7 条完整关联引文。本次记录费用 `0.033056 USD`，连同首次定位失败的运行累计 `0.057096 USD`，低于 `0.15 USD` 上限；未记录来源全文或 Provider 原始响应。
- 内部验证结束后活动研究 run 为 0，`3218`/`8288` 端口已关闭；本机没有 Evidence Graph Docker 容器，其他项目容器未被修改。
- 常规单元、E2E 和工程测试禁用付费 Provider；`test:managed` 的数据库部分连接托管开发库并在 pgTAP 事务中回滚。
- 真实 Provider 已通过 Tavily、DeepSeek 和百炼的专用低成本 smoke；日常测试不会外呼。
- Production 曾完成一条低范围中文真实研究和完成态重放验证。这是已存在部署的技术证据，不替代 C1-C6 的本地产品验收。

## 已知 MVP 缺口

- GitHub OAuth、项目列表、fixture/live 创建流程和结果页的本地用户 UI 验收。
- 核心研究闭环的用户验收和 P0/P1 缺陷收敛。
- `/app/settings`、语言偏好、项目数据删除和账号删除。
- 10 个固定问题及人工样本的 Evidence Eval。
- 3 个真实公开案例、案例文章、决策图和作品集回填。
- 干净环境的本地 Release Candidate 验收。

支付、团队、导出、定时研究、浏览器扩展、OCR、自托管模型和通用聊天不属于当前 MVP 收口范围。

## 下一步

等待 Draft PR #18 的 GitHub CI 完成并启动固定本地 URL，随后由用户一次性完成 GitHub OAuth、项目列表、fixture/live 研究和结果可追溯性验收；验收前不审核、不合并、不进入 C2。
