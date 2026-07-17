# Evidence Graph 项目状态

更新时间：2026-07-17

## 当前阶段

- 阶段：托管部署等待外部收口；持久化研究结果本地里程碑已完成。
- 分支：`feat/managed-deployment` 已推送远端；`feat/durable-research-results` 在独立 worktree 中完成 8 个本地提交，尚未 push。
- PR：持久化研究结果未创建 PR；必须先完成并合并托管部署 PR，再为本模块创建唯一 Draft PR。
- 当前任务：等待 Vercel 账号恢复审核结果；本地下一里程碑为报告发布，不混入当前分支。
- 外部 Provider 调用：已禁用。
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
| 托管部署 | 进行中 | 获得账号授权后完成 Supabase、Inngest、Vercel 配置和生产冒烟测试 |
| 持久化研究结果 | 本地已完成 | 原子研究事务、幂等 Writer、真实工作台和审核写回完成；等待托管部署合并后创建单一 Draft PR |

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
- `feat/managed-deployment` 已推送远端但未创建 PR；HTTPS 凭据缺少 `workflow` scope，因此 push URL 已改为本机现有 SSH 凭据，fetch URL 保持 HTTPS。
- 托管部署里程碑预检 `npm run test:managed` 已通过 Provider 边界扫描、33 个数据库测试、Schema lint、lint、类型检查、118 个单元测试、生产构建和 36 个 E2E；运行时显式禁用真实托管连接和付费 Provider。
- Vercel 账号恢复申请已提交，官方邮件给出的典型审核时间为 1 个工作日；当前没有站点 URL、Inngest 应用同步、生产冒烟或 Vercel 回滚结果。
- `create_managed_research` 已把项目、queued run 和月度次数收进同一事务；投递失败保留原项目/run，重投复用同一个 `runId`，不会重复创建或计费。
- Inngest 执行顺序已收敛为 `authorize -> begin -> execute -> persist/finalize`；Writer 在完整 Zod 与 owner/project/run 校验后按外键顺序幂等写入，最后才把 run 标记为 ready。
- 非 `demo` 工作台已通过 RLS Store 读取 queued/running/failed/ready 四态；排队与运行每 3 秒刷新，只有 `RESEARCH_DISPATCH_FAILED` 可以重投原事件。
- managed Claim 审核已写回 Supabase，并同时限定 `claimId + projectId`；保存失败会回滚目标 Claim，demo 继续保持纯客户端行为。
- 持久化研究结果聚焦门禁通过 Provider 扫描、51 个数据库测试、49 个闭环单测和 14 个 Auth/工作台/项目/Inngest E2E。
- 持久化研究结果完整 `npm run test:managed` 通过 Schema lint、全仓 lint、typecheck、142 个单元测试、生产构建和 36 个 E2E；运行时清空托管变量，未调用真实 OpenAI、Tavily、Supabase、Inngest 或 Sentry 远端。

## 下一步

1. 等待 Vercel 账号恢复审核通过，创建免费项目并取得稳定 Preview 与 Production 默认域名。
2. 配置两套 Supabase Site URL 和 Redirect allow list，同步 Inngest 应用并运行不含付费 Provider 的生产冒烟和 Vercel 回滚演练，完成托管部署 PR 闭环。
3. 托管部署合并后，为 `feat/durable-research-results` 创建唯一 Draft PR，执行独立 Claude 审核、CI 和 merge commit 闭环。
4. 本地下一里程碑进入 `feat/report-publishing`，实现报告发布、撤销、版本和公开分享，不提前创建堆叠 PR。
