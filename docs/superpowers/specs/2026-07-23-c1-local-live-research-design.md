# C1 本地真实研究运行环境设计

日期：2026-07-23
状态：已确认，进入实现

## 1. 目标

C1 只解决一个问题：让用户通过一个稳定的本地 URL 登录 Evidence Graph，从 UI 创建一条低范围中文研究，并由本地 Supabase、本地 Inngest 和真实 Tavily、DeepSeek、百炼 Provider 完成研究，最终检查来源、Claim、Evidence、运行日志和带引文报告。

本阶段不修复所有产品体验问题。真实操作中发现的 P0/P1 进入 C2 的有限清单；C1 只修复阻止本地真实链路启动或完成的问题。

## 2. 方案选择

### 2.1 本地产品操作默认真实，自动化回归固定 fixture

采用双入口：

- `npm run dev:local` 启动本地完整栈，要求显式真实研究确认和 `0.15 USD` 单次成本上限。用户从 UI 创建的研究调用真实 Provider。
- `npm run test:unit`、`npm run test:e2e`、`npm run test:ci` 和 `npm run test:managed` 强制 fixture，不因 `.env.local` 存在真实 Key 而联网。

这样满足用户日常查看真实结果的需求，同时避免 291 个单元测试和 82 个 E2E 因网络波动、Provider 输出变化或重复费用失去回归价值。已有 `npm run test:providers:live` 继续作为三家 Provider 的最小契约冒烟，不替代 UI 完整研究。

不采用“所有自动化测试真实外呼”：测试量与单次研究范围不匹配，无法提供稳定断言，也会把失败原因混入配额、网络和模型随机性。

### 2.2 本地认证使用 Supabase anonymous session

登录页新增一个双语的本地开发入口，Server Action 调用本地 Supabase `signInAnonymously()`。入口只有以下条件同时满足时才显示并可执行：

1. `NODE_ENV` 不是 `production`。
2. `LOCAL_DEV_AUTH_ENABLED=true`。
3. `NEXT_PUBLIC_SUPABASE_URL` 的 hostname 是 loopback。

`supabase/config.toml` 只为本地 CLI 开启 anonymous sign-in。Vercel Production 不读取该配置，正式登录继续只使用 GitHub OAuth。Server Action 在执行时重新检查全部条件，不能只依赖页面隐藏。

不采用本地 GitHub OAuth：它需要维护第二个 OAuth App 和回调，不增加 C1 的产品验收价值。不采用硬编码邮箱密码：会引入无必要凭据和账号初始化步骤。

### 2.3 一个本地启动命令编排三个服务

新增受测试约束的 Node.js 启动脚本：

1. 拒绝 Node 22 以外的运行时。
2. 启动或复用本地 Supabase。
3. 从 `supabase status -o json` 读取本地 URL、Publishable Key 和 Secret Key，合并写入 Git 忽略的 `.env.local`。
4. 保留已有 Provider Key，不在 stdout/stderr 打印变量值；拒绝符号链接并把文件权限固定为 `0600`。
5. 验证真实 Provider、确认令牌和 `0.15 USD` 上限齐全。
6. 在固定端口 `3218` 启动 Next.js，在 `8288` 启动固定版本 Inngest Dev Server，并同步 `http://127.0.0.1:3218/api/inngest`。
7. 任一子进程退出时终止另一个子进程；Supabase 保持运行，方便用户继续检查 Studio 和数据。

固定本地入口为 `http://127.0.0.1:3218/zh/auth/login`。不自动寻找随机端口，避免 Supabase、Inngest 和用户验收 URL 漂移。

### 2.4 本地 Live Provider 独立确认与成本上限

现有 `ALLOW_PAID_PROVIDER_SMOKE` 只描述最小 Provider 冒烟，不再复用于完整 UI 研究。C1 新增：

```text
RESEARCH_PROVIDER_MODE=live
ALLOW_LOCAL_LIVE_RESEARCH=I_CONFIRM_LOCAL_PAID_RESEARCH
LOCAL_LIVE_RESEARCH_COST_LIMIT_USD=0.15
```

非 Production 的 `createResearchProviders` 只有在三项有效并且全部 Provider Key 存在时才返回 live providers。Production 继续强制 live 和原有 `1 USD` 产品硬上限，不读取本地确认变量。

工作流接受一个服务端 `maxCostUsd`，默认保持 `1`。本地 live runtime 传入 `0.15`；每次 Provider 调用前检查累计成本，调用后记录真实 usage，达到或超过上限后停止后续调用并写入稳定错误码。该限制不承诺预测单个 Provider 调用的最终账单，只保证已记录累计成本达到上限后不再开始下一次调用。

## 3. 组件与文件边界

- `scripts/local-development.mjs`：本地 Supabase 环境准备、脱敏校验、端口检查和子进程编排。
- `tests/unit/local-development.test.ts`：环境合并、敏感值不输出、Node/端口/Provider 门禁的纯函数与脚本合约。
- `src/features/auth/local-development.ts`：本地认证可用性判断。
- `src/features/auth/actions.ts`：本地 anonymous sign-in Server Action。
- `src/app/[locale]/auth/login/page.tsx` 与双语 messages：只在门禁通过时显示本地入口。
- `src/providers/live/local-research-gate.ts`：本地完整研究的确认与成本上限解析。
- `src/providers/runtime.ts`：返回 Provider mode 和当前运行成本上限。
- `src/features/research/run-research-workflow.ts`：使用注入的成本上限，默认行为不变。
- `src/inngest/functions/run-research.ts`：把 runtime 成本上限传给工作流。
- `vitest.config.ts` 与 `playwright.config.ts`：常规测试显式固定 fixture。
- `.env.example`、`README.md`、`docs/deployment.md`：区分本地真实产品操作、Provider smoke 和 fixture 自动化。

## 4. 数据流

```text
npm run dev:local
  -> Supabase start/status
  -> 安全合并 .env.local
  -> 校验本地 auth + live Provider + 0.15 USD
  -> Next.js :3218 + Inngest :8288

用户打开本地登录页
  -> local gate 通过
  -> Supabase anonymous session
  -> 创建 Project + queued ResearchRun
  -> Inngest Dev Server 接收事件
  -> authorize -> read local Supabase input
  -> live providers + maxCostUsd=0.15
  -> durable steps -> local Supabase persistence
  -> 工作台轮询 ready/failed
```

## 5. 失败与恢复

- Supabase 未安装或无法启动：启动脚本退出，不启动 Next/Inngest。
- `.env.local` 是符号链接或无法收紧权限：退出，不写密钥。
- 缺 Provider Key、确认令牌错误或成本上限非法：在任何 Provider 请求前退出，只显示缺失变量名或稳定错误码。
- `3218` 或 `8288` 被占用：退出并指出端口名，不静默改端口。
- Inngest 启动失败：Next 子进程随之终止，避免 UI 创建无法执行的 queued run。
- Provider 失败或达到成本上限：沿用现有 failed run、稳定错误码和人工重投语义，不自动重跑付费研究。
- 本地 anonymous session 失效：返回登录页重新建立本地 session，不创建共享固定账号。

## 6. 测试

1. RED/GREEN 单测覆盖本地 auth 三重门禁、Production 禁用和 loopback URL。
2. RED/GREEN 单测覆盖本地环境合并、权限目标、敏感值脱敏、缺变量和端口占用。
3. RED/GREEN 单测覆盖 local live 确认、`0.15 USD` 上限、Production 默认 `1 USD` 和低上限工作流停止后续调用。
4. 配置合约证明常规 Vitest、Playwright 和 CI 不会继承 `.env.local` 的 live mode。
5. `npm run test:managed` 完整通过且无 Provider 网络请求。
6. Agent 启动 `npm run dev:local`，在浏览器完成本地登录、创建一条中文研究并检查 ready/failed、来源、Claim、Evidence 和报告。
7. 用户使用同一 URL 完成本地验收；用户通过前不创建 PR。

## 7. 明确不做

- 不配置或修改 Production，不更新 `release`。
- 不实现 Settings、账号删除、Evidence Eval 或 3 个真实案例。
- 不接新的 Provider，不增加 Provider 选择 UI。
- 不让 anonymous 登录在 Production 可用。
- 不清空用户本地数据库；需要重新加载 Auth 配置时只重启本地 Supabase 并保留数据卷。
- 不把 Key、Provider payload、来源全文或付费原始响应写入 Git、测试报告、日志或回复。

## 8. 完成标准

- `npm run dev:local` 在 Node 22 下从单一命令启动完整本地栈。
- 本地登录入口可用，Production 条件下不可用。
- 用户从 UI 创建的研究使用真实 Provider，并受 `0.15 USD` 本地上限约束。
- 自动化测试仍为 fixture-only，完整门禁通过。
- Agent 提供固定本地 URL 与验收清单；用户明确验收通过后才进入 PR 收口。
