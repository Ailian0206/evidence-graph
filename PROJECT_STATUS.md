# Evidence Graph 项目状态

更新时间：2026-07-23

## 当前阶段

- 阶段：真实 Provider Production 发布与真实研究验收已完成，后续回到本地优先的功能开发。
- 分支：`main` 是日常集成分支；`release` 是唯一 Vercel Production Branch，Preview 自动部署已关闭。
- PR：真实 Provider 接入唯一 PR [#17](https://github.com/Ailian0206/evidence-graph/pull/17) 已通过独立审核和全部 CI 后以 merge commit 合并。
- 当前任务：里程碑已闭环；日常改动继续集成到 `main`，只有明确发版时才更新 `release`。
- UI 优化：中文优先的 Neutral Product Studio 与均衡密度已覆盖公共页面、认证/项目页、工作台全部状态和公开报告，并合并到 `main`。
- 外部 Provider 调用：已接入 Tavily Search/Extract 与 DeepSeek `deepseek-v4-flash`；四项 Provider 变量已加密配置到 Vercel Production，并由最终部署加载。
- Embedding Provider：阿里云百炼 `text-embedding-v4` 固定输出 1536 维；兼容前向迁移 `20260723000100` 已应用到 Production。
- 生产部署：`https://evidence-graph-pi.vercel.app` 的真实 Provider 版本已部署为 `Ready / Current`，Deployment ID 为 `7MJSshcbs2A7ccYqHdcSUaTXrG6h`。
- 部署拓扑：只维护本地和 Production；本地使用本地 Supabase 和 fixtures，Vercel Preview 自动部署已关闭，只有 `release` 更新触发 Production。
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
| 证据工作台 | 已完成 | PR [#11](https://github.com/Ailian0206/evidence-graph/pull/11) 已通过独立审核和 CI，并以 merge commit `74c3b49` 合并 |
| 托管部署 | 已完成 | PR [#13](https://github.com/Ailian0206/evidence-graph/pull/13) 已合并；最小 Production 发布与数据库迁移已完成 |
| 持久化研究结果 | 已完成 | PR [#14](https://github.com/Ailian0206/evidence-graph/pull/14) 已通过独立审核和 CI，并以 merge commit `ce4b1a2` 合并 |
| 报告发布 | 已完成 | PR [#15](https://github.com/Ailian0206/evidence-graph/pull/15) 已通过独立审核和 CI，并以 merge commit `f42ae20` 合并 |
| 全局 UI 体验优化 | 已完成 | PR [#16](https://github.com/Ailian0206/evidence-graph/pull/16) 首轮 finding 已按 TDD 修复，重审与两个 CI job 通过后以 merge commit `72d3f55` 合并 |
| 真实 Provider 接入 | 已完成 | PR [#17](https://github.com/Ailian0206/evidence-graph/pull/17) 已通过独立审核和全部 CI，并以 merge commit `69b0109` 合并；Production 迁移、变量、部署、Inngest 同步和真实研究验收均已完成 |

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
- 证据工作台 `npm run test:ci`：lint、typecheck、76 个单元测试、生产构建和 29 个 E2E 测试全部通过。
- 工作台视觉门禁覆盖 390x844、1024x768 和 1440x1000，验证无横向溢出、面板重叠和空白画布；Cytoscape 多层 canvas 像素检查通过。
- 工作台图谱模型通过 200 个超长标签 Claim 测试，节点和边结构不随标签长度改变。
- PR #11 独立 Claude 审核结果为 `pass`，审核 SHA 与 `a664f91aa42e49984dfd8f711ce8f05ab062a0a4` 一致；GitHub CI 成功后以 merge commit `74c3b49` 合并。
- 托管环境契约测试 4 个通过；缺少托管变量时公开页面、构建和常规测试保持可用。
- 本地 Supabase 迁移、数据库约束和 RLS 共 33 个 pgTAP 测试通过，Schema lint 无警告。
- Supabase Auth 会话单测 4 个、Auth 与工作台聚焦 E2E 11 个通过；当前全量 85 个单元测试、类型检查、lint 和生产构建通过。
- 登录页已覆盖 390x844、1024x768 和 1440x1000 三种尺寸，无横向溢出、文字裁切或异常重叠。
- 图谱连续键盘导航竞态已增加确定性回归测试，目标 E2E 连续运行 10 次通过。
- 项目 Store、Supabase query adapter、Server Actions、Dashboard 和新建研究表单已完成；所有读写都重新携带当前 `ownerId`，创建前检查每月 3 次上限。
- 本地 Supabase 真实登录态下，项目列表、RLS 创建和归档操作通过；PostgREST `timestamptz` 偏移格式已在映射边界标准化。
- 项目工作区门禁通过 99 个单元测试、13 个 Auth/工作台/项目 E2E、类型检查、lint 和生产构建。
- Dashboard 和新建研究页已覆盖 390x844、1024x768 和 1440x1000 三种尺寸，无横向溢出、裁切或控件重叠。
- Inngest 事件使用 Zod 运行时校验，`runId` 同时作为事件与函数幂等键；单 owner 并发为 1，最多重试 3 次。
- Inngest webhook 使用 Admin client 读取 run，再显式核对 `ownerId/projectId/runId`；不匹配时抛出不可重试错误。
- `/api/inngest` 已通过官方 Next App Router 适配器导出 `GET/POST/PUT`；本地健康响应只返回能力布尔值，不泄露环境变量。
- Inngest 任务门禁通过 108 个单元测试、14 个 Auth/工作台/项目/Inngest E2E、类型检查、lint、生产构建和真实 Provider 扫描。
- 当前函数执行器只使用 fixture providers 和内存 workflow store，不调用真实 OpenAI/Tavily；Production Inngest 已同步，受控授权事件在工作流执行前停止，未触发 Provider。
- Next.js 16 服务端和客户端 instrumentation 已接入可选 Sentry；缺少 DSN 时不初始化，完整上传凭据缺失时不启用 source map 上传。
- Sentry `beforeSend` 递归移除 email、GitHub 用户名、研究问题、来源正文、quote 和 Provider payload；Vercel Analytics 不接收自定义研究数据。
- 全站已增加 nosniff、严格 Referrer Policy、受限 Permissions Policy、`DENY` frame 和稳定 `frame-ancestors` 防护。
- 监控与安全门禁的完整 `npm run test:ci` 通过 lint、typecheck、111 个单元测试、生产构建和 36 个 E2E。
- Provider 边界扫描已接入 quality job，能够拒绝真实 OpenAI/Tavily 端点、客户端敏感变量和非 fixture 网络 Provider；脚本回归测试通过。
- database job 使用本地 `supabase db start`，完成 reset、33 个 pgTAP、schema lint，并通过 `if: always()` 清理本地容器；与 CI 相同的 start、test、stop 路径已在本机验证。
- CI 门禁任务的完整 `npm run test:ci` 通过 lint、typecheck、112 个单元测试、生产构建和 36 个 E2E。
- 中文部署手册已覆盖 Vercel、Supabase、GitHub OAuth、Inngest、Sentry、环境变量作用域、发布回滚、备份恢复和密钥轮换。
- `verify:managed-env` 只输出变量名和配置状态；缺少托管变量时以 `MANAGED_ENV_INCOMPLETE` 退出，完整测试变量下通过，不打印变量值。
- 生产冒烟必须同时提供精确确认令牌和 HTTPS 非本地地址；HTTP、localhost、IPv4/IPv6 回环地址都在任何请求前拒绝。
- 默认生产冒烟只检查公开首页与安全 Header、公开示例、Auth 重定向和 Inngest 无签名拒绝；6 个门禁测试通过，未调用真实网络或付费 Provider。
- 部署文档与冒烟门禁的完整 `npm run test:ci` 通过 lint、typecheck、118 个单元测试、生产构建和 36 个 E2E。
- Supabase Production `dibngceljmdkcgrzxubx` 已应用三条仓库迁移；本地完整迁移链通过 89 个 pgTAP 和 Schema lint。此前创建的 Preview 保持闲置。
- GitHub OAuth Preview App `3734029` 和 Production App `3734035` 已创建；两套 Supabase GitHub Provider 已启用并验证，Preview Secret 已完成一次轮换。
- Inngest Production 已同步应用 `evidence-graph` 和函数 `run-managed-research`；此前创建的 Preview 环境保持闲置。
- Sentry EU 组织 `ailian0206` 和 Next.js 项目 `evidence-graph` 已创建；运行时 DSN 已配置，Source Map Token 保持可选未配置，尚未发送受控异常。
- Supabase、Inngest 和 Sentry 必需变量已配置为 Vercel Production 托管变量；仓库和本地工作区不保存生产 `.env` 文件。
- Preview 备份恢复演练已完成：远端 `public` 数据通过官方 CLI 导出，在本地用仓库迁移重建后恢复，33 个 pgTAP 和 Schema lint 通过，临时备份已删除。
- `feat/managed-deployment` 使用本机 SSH 凭据推送，HTTPS fetch 保持不变；PR #13 合并后远端模块分支已删除。
- 托管部署里程碑预检 `npm run test:managed` 已通过 Provider 边界扫描、33 个数据库测试、Schema lint、lint、类型检查、118 个单元测试、生产构建和 36 个 E2E；运行时显式禁用真实托管连接和付费 Provider。
- `create_managed_research` 已把项目、queued run 和月度次数收进同一事务；投递失败保留原项目/run，重投复用同一个 `runId`，不会重复创建或计费。
- Inngest 执行顺序已收敛为 `authorize -> begin -> execute -> persist/finalize`；Writer 在完整 Zod 与 owner/project/run 校验后按外键顺序幂等写入，最后才把 run 标记为 ready。
- 非 `demo` 工作台已通过 RLS Store 读取 queued/running/failed/ready 四态；排队与运行每 3 秒刷新，只有 `RESEARCH_DISPATCH_FAILED` 可以重投原事件。
- managed Claim 审核已写回 Supabase，并同时限定 `claimId + projectId`；保存失败会回滚目标 Claim，demo 继续保持纯客户端行为。
- 持久化研究结果聚焦门禁通过 Provider 扫描、51 个数据库测试、49 个闭环单测和 14 个 Auth/工作台/项目/Inngest E2E。
- 持久化研究结果初始 `npm run test:managed` 通过 Schema lint、全仓 lint、typecheck、142 个单元测试、生产构建和 36 个 E2E；运行时清空托管变量，未调用真实 OpenAI、Tavily、Supabase、Inngest 或 Sentry 远端。
- 同步 PR #12 后的 `npm run test:managed` 通过 Provider 边界扫描、33 个数据库测试、Schema lint、lint、类型检查、119 个单元测试、生产构建和 36 个 E2E；Playwright 改用 `next start`，消除了开发服务器首轮编译导致的导航竞态，并显式保持 Inngest 本地模式。
- Vercel 账号已恢复并通过 Google、GitHub 和 2FA 验证；Hobby 项目已从 GitHub `main` 导入，首次部署使用 Node 22、`npm ci` 和 `npm run build`，部署提交为 `b6e5858`。
- 用户于 2026-07-21 确认将 Vercel 生产验证拆为合并后的独立发布门禁；托管代码不得被表述为已生产上线。
- PR #13 独立 Claude 审核对 head `dadabf3` 返回 `pass`，两个 GitHub CI job 成功后以 merge commit `ad40664` 合并。
- 对齐 PR #13 与状态提交 `fd89aaf` 后，持久化研究结果 `npm run test:managed` 通过 Provider 扫描、51 个数据库测试、Schema lint、lint、typecheck、143 个单元测试、生产构建和 36 个 E2E。
- PR #14 首轮独立 Claude 审核对 head `861084c` 返回 `changes_requested`：已有 queued/running run 时再次创建会暴露数据库 `23505`。修复后该约束冲突转换为 `ACTIVE_RESEARCH_RUN_EXISTS`，表单提供双语提示，且失败事务不创建项目、不消耗额度、不投递 Inngest 事件。
- PR #14 审核修复后的 `npm run test:managed` 通过 Provider 边界扫描、54 个数据库测试、Schema lint、lint、typecheck、145 个单元测试、生产构建和 36 个 E2E；运行时清空托管与付费 Provider 变量。
- PR #14 独立 Claude 审核对修复 head `01d889e` 返回 `pass`，两个 GitHub CI job 成功后以 merge commit `ce4b1a2` 合并；远端模块分支已删除。
- 报告发布数据库状态机通过首次发布、幂等发布、版本切换、失败原子性、跨用户隔离、撤销、匿名读取和审计验证；对齐前 4 个 pgTAP 文件共 86 个测试通过，Schema lint 无 warning。
- Report Store、Server Actions 和工作台报告模式均使用稳定 DTO 与确定性 fixtures；发布与撤销从服务端会话推导 owner，公开读取不返回来源全文、owner、成本或运行日志。
- `/r/[slug]` 已绕过 locale proxy，中文和英文 fixture 使用独立稳定 slug；未知或撤销报告返回 404，canonical、Open Graph article metadata 和打印样式通过 E2E。
- 报告发布对齐前完整 `npm run test:managed` 通过 Provider 边界、86 个数据库测试、全仓 lint、typecheck、167 个单元测试、生产构建和 45 个 E2E；未调用真实或付费 Provider。
- 工作台图谱/报告和公开报告均覆盖 390x844、1024x768、1440x1000；对齐前截图确认无横向溢出、文字裁切、控件重叠、异常空白或模式切换位移，Cytoscape canvas 像素检查继续通过。
- 合并最新 `main` 后，报告发布 `npm run test:managed` 通过 Provider 边界、89 个数据库测试、Schema lint、全仓 lint、typecheck、170 个单元测试、生产构建和 45 个 E2E；三档公开报告与工作台报告截图复查通过。
- 报告发布分支已推送并创建唯一 Draft PR #15；Vercel 生产 URL、Inngest 同步、生产冒烟和回滚仍作为独立发布门禁，不随本 PR 宣称上线。
- PR #15 独立 Claude 审核对 head `b970acd` 返回 `pass`，两个 GitHub CI job 成功后以 merge commit `f42ae20` 合并；远端模块分支已删除。
- 全局 UI 体验优化已完成现状审计和三套方向对比；用户选择中文优先的 Neutral Product Studio 与均衡密度，并确认覆盖公共页面、认证/项目页、工作台全部状态和公开报告。
- 全局 UI 体验优化已统一系统字体、颜色、焦点、40px 触控目标、移动菜单和 active navigation；首页、作品、案例、笔记、证据预览、登录、项目页、工作台各运行状态和公开报告均完成中文优先的均衡密度改版，英文路由继续保留。
- 最终视觉矩阵覆盖 `/zh`、`/en`、`/zh/work`、Evidence Graph 案例、`/zh/notes`、`/zh/evidence`、登录、demo 工作台和公开报告，在 390x844、1024x768、1440x1000 三档共 27 个场景中验证无横向溢出、非图谱文字小于 12px、左侧装饰线、文字裁切、异常重叠或主要空白。
- 导航键盘操作、skip link、工作台图谱联动、Cytoscape canvas 像素、打印模式、120 字项目标题和 2000 字研究问题回归均通过；截图输出保留在本地忽略目录 `output/playwright/ui-refresh/`，未提交生成物。
- UI 里程碑初始完整 `npm run test:managed` 通过 Provider 边界扫描、89 个数据库测试、Schema lint、全仓 lint、typecheck、177 个单元测试、生产构建和 81 个 E2E；运行时显式清空托管与付费 Provider 变量，未调用真实 Supabase、Inngest、Sentry、OpenAI 或 Tavily 远端。
- PR #16 首轮独立 Claude 审核对 head `1c2e9b9` 返回 `changes_requested`：`.secondary-action:hover` 的重复前景色声明使“联系我 / Contact”文字与深色背景同色。修复先用 Playwright 复现 `rgb(24, 32, 28)` 的 RED，再删除错误声明并验证白色前景 GREEN；修复后完整门禁通过 89 个数据库测试、177 个单元测试、生产构建和 82 个 E2E。
- PR #16 独立 Claude 重审对 head `73a8f855c3ea0c66dcc88de4e61012b5d5194ebd` 返回 `pass`；GitHub 的质量与数据库两个 job 均成功，随后以 merge commit `72d3f55facbd196d634caeaad6de1ed06e8d259f` 合并，远端模块分支已删除。
- Vercel Production 已使用现代 Supabase Publishable/Secret Key；旧版 JWT API Key 已停用，服务端授权查询返回预期业务错误而非 `401` 或无效密钥错误。
- Supabase Site URL 和本地/Production Redirect URL 已配置，Inngest Production 同步成功；默认生产冒烟在迁移后通过全部四项检查，明确未运行付费 Provider。
- Production 已应用 `20260716000100`、`20260717000100`、`20260717000200` 三条迁移；远端确认 `manual_urls`、原子研究 RPC 和报告发布 RPC 均存在。
- 一次性 Vercel 回滚与恢复演练已完成；后续仅在真实发布故障时回滚，不再作为个人项目的例行流程。
- 用户于 2026-07-22 决定将部署拓扑收敛为本地开发与 Production，不再配置 Vercel Preview；现有 Preview Supabase、OAuth App 和 Inngest 环境保持闲置且不删除。
- Production 首个真实用户闭环已完成：GitHub 登录、创建中文研究、Inngest fixture 运行完成、证据/图谱读取、Claim 审核写回、报告发布、匿名公开访问和引文锚点跳转均通过；未调用真实或付费 Provider。
- 真实项目页与动态公开报告首次访问暴露 `DYNAMIC_SERVER_USAGE`。两个路由移除仅适用于 fixture 的 `generateStaticParams` 后均改为请求时渲染，分别以 `3c92b30` 和 `af71530` 提交并完成 Production 复验。
- 生产闭环修复门禁通过全仓 lint、22 个测试文件共 182 个单元测试、生产构建，以及认证与报告发布 9 个 E2E；匿名公开报告请求返回 `200 text/html`。
- 真实 Provider 适配器已覆盖 Tavily Search/Extract、DeepSeek `deepseek-v4-flash` 五类结构化操作和百炼 `text-embedding-v4` 1536 维向量；Production 强制 live，开发和 CI 默认 fixtures。
- 专用付费冒烟在显式 `0.10 USD` 上限内通过 Tavily、DeepSeek 和百炼三家真实请求，未输出 Key、请求 payload、来源正文或模型正文；实现变化未触及已验证的请求参数，因此未重复产生费用。
- `20260723000100_embedding_model_v4.sql` 保留历史 `text-embedding-3-small` 元数据、新行默认 v4、未知模型继续拒绝；本地完整迁移链 4 个 pgTAP 文件共 93 项和 Schema lint 通过。
- 真实 Provider 里程碑完整 `npm run test:managed` 在显式清空 Provider 变量后通过 Provider 边界、数据库、lint、typecheck、24 个文件共 282 个单元测试、生产 build 和 82 个 E2E，默认路径未调用 Provider 网络。
- PR #17 独立 Claude 审核对 head `302ead5057ad4895db2b174da2fb8c5f1056af14` 返回 `pass`，质量、数据库和 Vercel 检查全部成功，随后以 merge commit `69b0109890566e539dfc0d3b517ea5c8208866fa` 合并；远端模块分支已删除。
- Production 发布期间依次修复 Unicode 来源分块偏移、来源正文预算、Inngest 32 MiB 向量状态、混合证据中的非精确 quote，以及数据库已 ready 后 Inngest 重试误报失败；对应提交为 `35353a6`、`3839f12`、`c6c5f17`、`38ec8f6` 和 `6bd3e79`。
- 最终 `npm run test:managed` 通过 Provider 边界、93 项数据库断言、Schema lint、全仓 lint、typecheck、291 个单元测试、Production build 和 82 个 E2E；五个发布修复均经独立审查，Critical/Important 为 0。
- Vercel 最终 Deployment `7MJSshcbs2A7ccYqHdcSUaTXrG6h` 为 `Ready / Current`；Inngest Production 应用 `evidence-graph` 已同步 1 个函数，结果为 `No change / Synced app`。
- 最终默认 Production smoke 通过公开首页与安全 Header、公开确定性示例、Auth 重定向和 Inngest 无签名拒绝四项检查，未调用付费 Provider。
- 低范围中文真实研究 `run_00efc30e-49dd-4fc1-8fca-65654fc1b9ad` 验收为 `ready`：3 次搜索、18 个来源、1078 个来源分块、2 个主张、3 条证据关系、1 份草稿报告和 3 条引文，估算费用 `0.084784 USD`，无业务错误。
- 已完成研究的最终重放 `01KY6TBFHVRJBH8YMGGVQ72P5N` 在 2.155 秒内完成，Provider steps 与 lifecycle steps 均为 0，确认不会重复调用 Provider 或改写已完成结果。

## 下一步

1. 回到本地优先的功能开发，日常验证使用本地 Supabase 与 fixtures，不触发付费 Provider。
2. 仅在明确发版时将已验证的 `main` 更新到 `release`，触发唯一的 Vercel Production 部署。
