# Evidence Graph 项目状态

更新时间：2026-07-28

## 当前阶段

- 当前里程碑：C2“核心研究闭环与缺陷收敛”正在分支 `feat/c2-core-loop-hardening` 实现。
- 当前进度：基线 lint、typecheck 和单元测试 `359/359` 通过；Agent 已在用户 Chrome 登录态完成核心流程走查并冻结 4 个 P1，设计见 `docs/superpowers/specs/2026-07-28-c2-core-loop-hardening-design.md`。
- 下一次用户可见结果：所有 Claim 均可审核；创建失败保留输入；人工审核真实约束新发布报告，被拒绝内容不会进入新的公开版本。
- 当前禁止：不得提前实现 C3-C6，不得更新 `release`，不得执行 Production 迁移、变量修改、Inngest 同步或部署。
- 路线图：`docs/roadmap.md`。

## 真实完成度

| 维度 | 当前状态 | 说明 |
| --- | --- | --- |
| 代码完成度 | C2 设计完成 | 4 个 P1 已复现并冻结，尚未开始产品代码 GREEN |
| Agent 本地验收度 | C2 基线走查完成 | 已复现 Claim 隐藏、审核与发布脱节、创建失败丢输入和项目状态误导 |
| 用户反馈状态 | 异步接收 | 用户可继续体验并提交问题；反馈不回溯阻断已通过门禁的开发流程 |
| 产品完成度 | 未完成 | Settings/删除、Evidence Eval、3 个真实案例和 Release Candidate 尚未完成 |
| Production 状态 | 有可用历史基线，当前冻结 | `release` 是唯一 Production Branch；C6 前不再发布 |

结论：Evidence Graph 不是“已经开发完成”，当前处于本地 MVP 收口阶段。

## 当前环境基线

- 分支：`main` 是日常开发与集成分支；`release` 只用于明确批准的 Production 发布。
- Vercel：Preview 自动部署已关闭。
- 托管开发数据库：当前 Supabase 项目用于 C1-C6 开发；本地不再启动 Supabase Docker。Schema 继续由仓库 4 条迁移和 4 个 pgTAP 文件管理。
- 本地应用：固定目标端口 `3218` 正在运行，C1 验收入口为 `http://127.0.0.1:3218/zh`，登录直达入口为 `http://127.0.0.1:3218/zh/auth/login`。
- 本地 Inngest：固定端口 `8288` 正在运行，使用 CLI `1.38.1` 可正常扫描队列的最小值 5 个 worker；PR 收口或本地测试结束后停止。
- 本地认证：使用现有 GitHub OAuth 和 loopback redirect，不启用托管 anonymous sign-in。
- 本地 Provider：Live adapters 已实现；C1 真实研究使用 Git 忽略且权限收紧的运行文件，并同时限制来源、正文、embedding 批次和费用。
- 数据库门禁：本地 `test:db:hosted` 只运行 linked pgTAP 与 lint；migration reset 仅在 GitHub Actions 的 `test:db:ci` 执行。
- Node.js：本地和 CI 使用 `v22.22.1`。

## 产品里程碑

| 里程碑 | 状态 | 完成门禁 |
| --- | --- | --- |
| C0 规划重置与真实进度基线 | 已完成 | Roadmap、执行流程、状态口径和流程复盘一致，文档验证通过 |
| C1 本地真实研究运行环境 | 已完成 | PR #18 已通过自动化、Agent 本地验收、独立审核和 CI，并以 merge commit 合并 |
| C2 核心研究闭环与缺陷收敛 | 进行中 | 已确认的 P0/P1 清单关闭并完成模块门禁 |
| C3 Settings 与账号/数据生命周期 | 尚未开始 | 本地语言、项目删除和测试账号删除通过 Agent 验收与模块门禁 |
| C4 Evidence Eval | 尚未开始 | 10 题评测达到产品计划门槛并经 Agent 人工样本抽查 |
| C5 真实案例与作品集回填 | 尚未开始 | 3 个真实案例和作品集页面通过 Agent 验收与模块门禁 |
| C6 本地 Release Candidate | 尚未开始 | 固定候选提交通过完整门禁和 Agent walkthrough |
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
| C1 本地真实研究运行环境 | 已合并 | PR #18 |

这些记录只证明技术模块通过当时门禁，不等于当前产品已经完成全部 MVP 范围；用户反馈继续异步进入后续修复。

## 最近验证基线

- 2026-07-28 C2 worktree 基线通过 lint、typecheck 和单元测试 `359/359`。用户 Chrome 登录态走查确认：20 条 Claim 中只有 11 条 Evidence-linked Claim 出现在审核列表；rejected Claim 仍保留在草稿且发布按钮可用；月额度错误会清空新建表单；完成研究的 active 项目仍显示“进行中”。四项均列为 C2 P1。
- 2026-07-27 PR #18 的独立 Claude 审核对 head `f50e598` 返回 `pass`，未发现可复现的正确性、安全性、数据隔离或测试可信度问题；GitHub 代码门禁和 Supabase Schema/RLS/lint 两项 CI 均通过，随后以 merge commit `ea06616` 合并到 `main` 并删除远端模块分支。
- 2026-07-27 用户明确取消“等待用户本地验收后再审核”的流程门禁。此后自动化和 Agent 本地验收通过即直接完成独立 Claude 审核、CI 和 merge commit；用户后续发现的问题继续提交和修复，不阻塞 PR 或下一里程碑。Production 发布仍保留单独的用户明确授权门禁。
- 2026-07-27 第三轮验收明确产品职责：一个研究项目可持续产生多个报告版本；“研究项目”保留过程入口，“报告库”按项目聚合版本产物，查看报告统一进入 `?view=report`。
- 主张审核操作已移入当前选中主张卡片；接受或拒绝后自动移动到下一条待审核主张并支持 6 秒撤销，不再使用脱离上下文的底部固定操作栏。全站品牌标记已由 `A/` 简化为 `A`。
- 本轮全仓 lint、typecheck、单元测试 `359/359`、production build 和 E2E `85/85` 通过；新增报告移动端深链和主张审核自动推进/撤销 E2E。`test:managed` 的 Provider 边界通过，但本机 Docker 未运行，托管 pgTAP runner 在连接 `/var/run/docker.sock` 时停止；Draft PR #18 的 GitHub CI 已通过代码门禁与 Supabase Schema/RLS/lint 两项复验，例行门禁未调用付费 Provider。
- 已在用户 Chrome 登录态对 `/zh/app`、`/zh/app/reports` 和 20 条主张的完成态工作台完成 390x844、1024x768、1440x1000 三档验收：账号摘要和 `A` 标记可见，5 个报告版本链接均带 `?view=report`，移动端报告深链默认显示“图谱 / 报告”，审核控件保持在选中主张卡片内；各页面没有横向溢出、裁切或控件脱离。
- Chrome 快速切页期间出现过一次 Supabase Auth `fetch failed`，直接连通性检查正常且刷新后恢复，随后三档验收均完成；该现象未稳定复现，未用错误重定向或静默吞错掩盖外部认证失败。
- 2026-07-27 用户复验发现报告列表使用了 Schema 中不存在的 `reports -> projects` 直接关系，托管 PostgREST 返回 `PGRST200`。`3107107` 改为已有外键链 `reports -> research_runs -> projects`；回归测试先确认 `2` 项 RED，再达到 `4/4` GREEN。
- 修复后已在用户 Chrome 登录态刷新 `/zh/app/reports`：页面返回 `200`，正确显示 `5` 条报告，浏览器控制台无错误，文档宽度与 1536px 视口一致；服务端不再出现 `REPORT_LIST_QUERY_FAILED`。
- 当前修复通过全仓 lint/typecheck、单元测试 `347/347`、production build 和 E2E `83/83`。本机 Docker 未运行，`test:managed` 的 Provider 边界通过后在 pgTAP 容器启动前停止；当前提交的数据库门禁由同一 PR 的 GitHub CI 复验。
- 第二轮验收修复明确区分公共 `/evidence`“产品介绍”和受保护 `/app`“进入工作台”，登录后统一显示“研究项目 / 研究报告”、最小 GitHub 账号摘要和退出入口，并新增 `/app/reports` 报告列表。
- GitHub 登录按钮增加提交中状态并阻止重复提交；实际本地服务在 390x844 视口点击后已整页跳转到 GitHub 授权登录页，回调保持 `127.0.0.1:3218` 同源。OAuth 设计不是弹窗，已经授权过应用时 GitHub 也可能直接回调而不重复展示授权确认页。
- 创建研究和 queued/running 状态增加 loading 动画并遵守 reduced motion；新建表单移除双重 focus 边框、允许来源链接动作换行；创建页、运行状态和完成工作台均提供可见返回入口。
- 功能实现 head `f10479b` 的 `test:managed` 通过：Provider 边界检查、托管 pgTAP `93/93`、Schema lint、全仓 lint/typecheck、单元测试 `347/347`、production build 和 E2E `83/83`；例行门禁未调用付费 Provider。
- 登录页和确定性完成态工作台已在 390x844、1024x768 和 1440x1000 三档视口完成自动 UI 审计与截图检查，没有横向溢出、文字裁切或异常重叠；实际本地登录页三档视口也没有横向溢出或控制台错误。
- 早期 Codex 会话已确认 ChatGPT Chrome Extension 安装、启用且 native host 配置正确，但当时未发现可控制的 Chrome 标签页；后续会话已恢复用户登录态 Chrome 控制并完成当前三档验收。
- C1 最终聚焦门禁通过：provider 边界检查、7 个测试文件 `180/180` 和全仓 typecheck。
- 第一次用户验收发现两个阻塞：公共站点没有受保护工作台入口；OAuth callback 把 `127.0.0.1` 绝对重定向为 `localhost`，导致 host-only 会话 cookie 丢失。`bd3aed3` 增加双语全站入口，`2eb1251` 改为同源相对重定向，两项均先确认 RED 再达到 GREEN。
- 修复后 `test:managed` 通过：托管 pgTAP `93/93`、Schema lint、全仓 lint/typecheck、单元测试 `328/328`、production build 和 E2E `82/82`；例行门禁未调用付费 Provider。
- 入口已在 390x844、1024x768 和 1440x1000 三档视口完成截图检查；移动端入口位于折叠菜单，未出现横向溢出、裁切或重叠。开发服务器的 callback 失败响应已确认使用相对 `Location`。
- fixture 工作流连接托管开发库后达到 `ready`，Provider 外呼和费用均为 0；当时 Chrome 扩展自动化通信不可用，后续会话已恢复并完成当前浏览器验证。
- 受限 live 工作流达到 `ready`：4 个来源、35,331 个正文字符、35 个 chunks、4 个 embedding 批次、3 次搜索、61,196 tokens、11 条 Claims、7 条 Evidence links 和 7 条完整关联引文。本次记录费用 `0.033056 USD`，连同首次定位失败的运行累计 `0.057096 USD`，低于 `0.15 USD` 上限；未记录来源全文或 Provider 原始响应。
- 内部验证结束后活动研究 run 为 0，`3218`/`8288` 端口已关闭；本机没有 Evidence Graph Docker 容器，其他项目容器未被修改。
- 常规单元、E2E 和工程测试禁用付费 Provider；`test:managed` 的数据库部分连接托管开发库并在 pgTAP 事务中回滚。
- 真实 Provider 已通过 Tavily、DeepSeek 和百炼的专用低成本 smoke；日常测试不会外呼。
- Production 曾完成一条低范围中文真实研究和完成态重放验证。这是已存在部署的技术证据，不替代 C1-C6 的本地产品验收。

## 已知 MVP 缺口

- 核心研究闭环的 P0/P1 缺陷收敛。
- `/app/settings`、语言偏好、项目数据删除和账号删除。
- 10 个固定问题及人工样本的 Evidence Eval。
- 3 个真实公开案例、案例文章、决策图和作品集回填。
- 干净环境的本地 Release Candidate 验收。

支付、团队、导出、定时研究、浏览器扩展、OCR、自托管模型和通用聊天不属于当前 MVP 收口范围。

## 下一步

按 C2 设计编写 TDD 实施计划，依次修复 Claim 完整审核、已审核报告版本、创建失败恢复和项目状态表达；随后运行托管数据库、完整自动化、三档浏览器验收、独立审核和 CI。用户反馈继续异步接收，Production 继续冻结。
