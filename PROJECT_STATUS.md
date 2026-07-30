# Evidence Graph 项目状态

更新时间：2026-07-30

## 当前阶段

- 当前里程碑：C4“Evidence Eval 与证据质量门禁”正在进行中，模块分支为 `feat/c4-evidence-eval`。
- 当前进度：C4 四域修复后的真实重测在第 3 题按门禁停止，累计费用 `0.059527 USD`。对应 fixture-first 稳定性修复已完成：多域门禁会在 Claim extraction 阶段要求每个必需来源先产出有依据的候选主张，避免后续 linking 无 Claim 可连；Draft PR #22 继续跟踪。
- 下一门禁：取得新的付费上限授权重跑完整 10 题，验证 Claim 与 Evidence 两阶段的四域覆盖；未通过真实门禁前不进入独立审核、合并或 C5。
- 默认开发工作流：Trellis 3.4.2；新任务使用 `.trellis/tasks/` 与 `.trellis/spec/`，`docs/superpowers/` 只保留历史记录。
- 当前禁止：不得未经确认调用真实 Provider，不得开始 C5-C6，不得删除 Production 用户或数据，不得更新 `release` 或部署。
- 路线图：`docs/roadmap.md`。

## 真实完成度

| 维度 | 当前状态 | 说明 |
| --- | --- | --- |
| 代码完成度 | C4 评测、受限 live 收集与四域修复已实现 | 固定题集、评测器、CLI、累计预算、不同域名来源优先级和一次缺域补链已通过 fixture 验证 |
| Agent 本地验收度 | C4 真实门禁仍未通过 | 首轮完整评测为 5/6 指标通过；四域修复后的重测仅完成 3 题并在第 3 题停止。后续 fixture 稳定性修复已通过完整单元测试，但尚未经真实重测 |
| 用户反馈状态 | 异步接收 | 用户可继续体验并提交问题；反馈不回溯阻断已通过门禁的开发流程 |
| 产品完成度 | 未完成 | C4 真实 Evidence Eval 尚未达到 4 域门槛；3 个真实案例和 Release Candidate 尚未开始 |
| Production 状态 | 有可用历史基线，当前冻结 | `release` 是唯一 Production Branch；C6 前不再发布 |

结论：Evidence Graph 不是“已经开发完成”，当前处于本地 MVP 收口阶段。

## 当前环境基线

- 分支：`main` 是日常开发与集成分支；`release` 只用于明确批准的 Production 发布。
- Vercel：Preview 自动部署已关闭。
- 托管开发数据库：当前 Supabase 项目用于 C1-C6 开发；本地不再启动 Supabase Docker。Schema 继续由仓库 5 条迁移和 4 个 pgTAP 文件管理。
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
| C2 核心研究闭环与缺陷收敛 | 已完成 | PR #19 已通过自动化、Agent 本地验收、独立审核和 CI，并以 merge commit 合并 |
| C3 Settings 与账号/数据生命周期 | 已完成 | PR #20 已通过 Agent 验收、独立审核和 CI，并以 merge commit 合并 |
| C4 Evidence Eval | 进行中 | 首轮真实 10 题为 5/6 指标通过；四域修复后的重测在第 3 题仍触发覆盖门禁，需 fixture 修复后重新取得付费授权 |
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
| C2 核心研究闭环与缺陷收敛 | 已合并 | PR #19 |

这些记录只证明技术模块通过当时门禁，不等于当前产品已经完成全部 MVP 范围；用户反馈继续异步进入后续修复。

## 最近验证基线

- 2026-07-30 C4 Claim extraction 四域稳定性修复已推送到 Draft PR #22；head `ff2b534` 的 GitHub 代码质量门禁与 Supabase Schema/RLS/lint 门禁均通过。真实重测仍需新的付费授权，因此 PR 保持 Draft/Open，尚未启动独立 Claude 审核。
- 2026-07-30 针对重测第 3 题的失败完成 fixture-first 稳定性修复：启用多域门禁时，Claim extraction payload 会携带必需来源 URL 及 chunk-to-URL 映射，DeepSeek 指令要求每个必需来源至少产出一个有依据的候选主张，避免 linking 阶段面对没有对应 Claim 的来源。新增测试先得到 `2` 项 RED，修复后聚焦测试 `111/111`、Provider boundary、10 题 fixture eval、lint、typecheck 和完整单元测试 `426/426` 通过；未再次调用付费 Provider。
- 2026-07-30 用户批准独立 `0.25 USD` 总上限后执行 C4 四域修复真实重测。`technical-vector-store` 与 `technical-durable-workflow` 均为 `ready`，分别覆盖 4 个 Evidence domains，费用为 `0.019397 USD` 和 `0.020124 USD`；`technical-citation-verifiability` 收集 4 个来源域名后在 linking 阶段触发 `EVIDENCE_DOMAIN_COVERAGE_LOW`，费用为 `0.020006 USD`。收集器按首个失败停止，固定题集完成率为 `2/10`，累计费用 `0.059527 USD`；完整引用、关系和报告指标未从残缺批次重算。真实产物仍为 Git 忽略且权限 `0600`，再次调用付费 Provider 需要新的明确授权。
- 2026-07-30 C4 四域覆盖 fixture 修复完成：搜索候选优先填充不同域名，质量门禁可要求 4 个 Evidence domains，缺域时只对缺失域名调用一次补链并使用独立 idempotency key 和 usage。受影响模块 `127/127`、单独复跑 UI 文件 `11/11`、fixture eval、Provider boundary、lint 和 typecheck 通过；全量 unit 首轮为 `423/425`，仅两项无关 UI 输入测试在并发负载下超过 5 秒且单文件复跑通过。未再次调用付费 Provider。
- 2026-07-30 Draft PR #22 的代码 head `779c426` 通过 GitHub 代码质量门禁和 Supabase Schema/RLS/lint 门禁。真实评测的四域覆盖指标仍失败，因此不启动独立 Claude 审核、不合并 PR，也不开始 C5。
- 2026-07-30 C4 真实 10 题评测在用户批准的 `0.50 USD` 总上限内完成，预算账面总额 `0.477799 USD`（含 `0.010 USD` 保守预留），最终成功批次费用 `0.190739 USD`，单题最高 `0.02009 USD`。10/10 runs 为 ready，65/65 exact quotes、无引用事实段落 0、20 条人工关系抽查正确 19 条（95%）；只有来源域名覆盖失败，8/10 案例的 Evidence links 仅覆盖 1-3 个域名。真实输入、来源文本与 Provider 响应均保留在权限 `0600` 的 Git 忽略文件中；未触碰 Production。
- 2026-07-30 C4 非付费评测基线完成：固定 10 题覆盖技术选型、产品竞品和市场事实，fixture 输出 Quote 精确率 `100%`、无引用事实段落 `0`、Evidence Relation 准确率 `100%`、每题来源域名 `4`、完成率 `100%`、费用 `0 USD`；失败输入可定位 Run、Claim、Evidence、Chunk、Report 和 Citation。Provider 边界、lint、typecheck、单元测试 `412/412`、production build 和 E2E `88/88` 通过；未调用真实 Provider，真实评测总成本门限冻结为 `0.50 USD`，等待单独授权。
- 2026-07-30 作品站与 Evidence Graph 产品壳层通过 Route Groups 完成拆分，由 PR #21 跟踪。作品站保留个人导航与 Footer；登录、匿名 Demo 和受保护工作台只显示产品头部，原有 URL 保持不变。本地 lint、typecheck、单元测试 `400/400`、production build 和 E2E `88/88` 通过，390x844、1024x768、1440x1000 三档布局与图谱 canvas 像素检查通过；未调用付费 Provider，Production 保持冻结。
- 2026-07-29 C3 PR #20 的独立 Claude 审核对 head `1c15c89` 返回 `pass`，两项 GitHub CI 均通过，随后以 merge commit `fb443d1` 合并到 `main`。完整门禁通过 Provider 边界、托管 pgTAP `106/106`、lint、typecheck、单元测试 `396/396`、production build 和 E2E `88/88`。Agent 在用户 Chrome 登录态验证中英文语言保存与恢复、精确账号名门禁和 390x844、1024x768、1440x1000 三档布局；一次性项目删除后旧项目入口与公开报告 slug 均失效，现有账号未删除，Production 保持冻结。
- 2026-07-28 C2 PR #19 的独立 Claude 审核对 head `6758dde` 返回 `pass`，两项 GitHub CI 均通过，随后以 merge commit `de567b0` 合并到 `main`。完整门禁通过 lint、typecheck、单元测试 `384/384`、build、E2E `87/87`、托管 pgTAP `98/98`、public Schema lint 和 Provider 边界；最新验收差异的聚焦 lint 与 E2E `17/17` 复验通过。Agent 在用户 Chrome 登录态完成一条 fixture 研究，确认 GitHub 用户信息、生成 Loading、Claim 接受/拒绝、审核约束发布、报告库和公开报告均可用；未调用付费 Provider，Production 保持冻结。
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

- 真实 Evidence Eval 的 Evidence link 四域覆盖稳定性；四域修复后的重测在第 3 题仍未达到门禁。
- 3 个真实公开案例、案例文章、决策图和作品集回填。
- 干净环境的本地 Release Candidate 验收。

支付、团队、导出、定时研究、浏览器扩展、OCR、自托管模型和通用聊天不属于当前 MVP 收口范围。

## 下一步

C4 四域重测失败后的 fixture-first 稳定性修复已完成。下一步需要新的付费授权与成本上限重跑真实 10 题。C4 通过前不开始 C5，Production 继续冻结。
