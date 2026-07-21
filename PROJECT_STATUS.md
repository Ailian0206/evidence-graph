# Evidence Graph 项目状态

更新时间：2026-07-21

## 当前阶段

- 阶段：全局 UI 体验优化本地实现与完整门禁已通过，等待唯一 Draft PR 审核。
- 分支：`feat/ui-experience-refresh` 已从最新 `main` 创建，并在独立 worktree 中进行。
- PR：报告发布 PR [#15](https://github.com/Ailian0206/evidence-graph/pull/15) 已合并；UI 里程碑尚未创建 PR，下一步创建唯一 Draft PR。
- 当前任务：推送 `feat/ui-experience-refresh`，创建唯一 Draft PR，并依次完成独立 Claude 审核、GitHub CI 和 merge commit 合并。
- UI 优化：中文优先的 Neutral Product Studio 与均衡密度已覆盖公共页面、认证/项目页、工作台全部状态和公开报告；本地完整门禁已通过。
- 外部 Provider 调用：已禁用。
- Embedding Provider：已决定后续接入阿里云百炼 `text-embedding-v4` 并固定输出 1536 维；等待用户提供账号和密钥，当前不接入、不调用真实服务。
- 生产部署：数据库和外部服务配置进行中，Vercel 尚未部署。
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
| 托管部署 | 代码已合并，发布待完成 | PR [#13](https://github.com/Ailian0206/evidence-graph/pull/13) 已合并；Vercel 生产验证仍是后置发布门禁 |
| 持久化研究结果 | 已完成 | PR [#14](https://github.com/Ailian0206/evidence-graph/pull/14) 已通过独立审核和 CI，并以 merge commit `ce4b1a2` 合并 |
| 报告发布 | 已完成 | PR [#15](https://github.com/Ailian0206/evidence-graph/pull/15) 已通过独立审核和 CI，并以 merge commit `f42ae20` 合并 |
| 全局 UI 体验优化 | 本地门禁已通过 | 中文优先的 Neutral Product Studio 与均衡密度已完成实现；89 个数据库测试、177 个单元测试、81 个 E2E 和三档视觉矩阵通过，等待唯一 Draft PR 审核 |

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
- 当前函数执行器只使用 fixture providers 和内存 workflow store，不调用真实 OpenAI/Tavily；尚未连接外部 Inngest，也未发送真实事件。
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
- Supabase 组织 `Ailian` 已创建东京区 Preview `vooexhwkqzymltwewcqc` 和 Production `dibngceljmdkcgrzxubx`；两套远端迁移、33 个 pgTAP 和 Schema lint 均通过。
- GitHub OAuth Preview App `3734029` 和 Production App `3734035` 已创建；两套 Supabase GitHub Provider 已启用并验证，Preview Secret 已完成一次轮换。
- Inngest 组织 `Ailian` 已创建 Production 和 Preview `preview-e7881f94` 环境；两套 Event Key、Signing Key 已写入本地忽略文件，尚未同步部署应用。
- Sentry EU 组织 `ailian0206` 和 Next.js 项目 `evidence-graph` 已创建；运行时 DSN 已配置，Source Map Token 保持可选未配置，尚未发送受控异常。
- `verify:managed-env` 已通过 Supabase、Inngest 和 Sentry 必需变量检查；真实密钥只存在于权限为 `0600` 的 `.env.local`，未进入 Git。
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
- Vercel 恢复工单于 2026-07-17 提交；截至 2026-07-21 仍无审核结果，已在原邮件线程跟进。当前没有站点 URL、Inngest 应用同步、生产冒烟或 Vercel 回滚结果。
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
- UI 里程碑完整 `npm run test:managed` 通过 Provider 边界扫描、89 个数据库测试、Schema lint、全仓 lint、typecheck、177 个单元测试、生产构建和 81 个 E2E；运行时显式清空托管与付费 Provider 变量，未调用真实 Supabase、Inngest、Sentry、OpenAI 或 Tavily 远端。
- Vercel 账号恢复仍未完成；当前 UI 里程碑只证明代码和本地门禁完成，不代表生产上线，生产 URL、Supabase Redirect、Inngest 同步、生产冒烟和回滚演练继续作为合并后的独立发布门禁。

## 下一步

1. 推送 `feat/ui-experience-refresh` 并创建唯一 Draft PR，完成独立 Claude 审核与 GitHub CI 闭环后使用 merge commit 合并。
2. 合并后同步本地 `main`，记录最终 PR、审核 SHA、CI 与 merge commit 状态。
3. Vercel 账号恢复后取得 Preview 与 Production URL，配置 Supabase Redirect、同步 Inngest，并完成生产冒烟和回滚演练。
