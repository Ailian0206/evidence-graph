# C1 本地真实研究运行环境 Implementation Plan

> **状态：已停止，不得继续执行。** 2026-07-23 经用户确认，C1 改用托管开发 Supabase，并取消本地 Supabase Docker 与 remote anonymous 登录。本文保留为第一版实现记录；第三版设计完成书面审阅后必须重写实施计划，未重写前不得恢复实现或启动服务。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一个本地命令启动 Supabase、Inngest 和 Next.js，让用户通过仅开发环境登录从 UI 完成受成本限制的真实中文研究，同时保持自动化测试 fixture-only。

**Architecture:** 本地 Node 启动脚本从 Supabase CLI 生成受权限保护的运行配置，并编排固定端口服务；本地 anonymous Auth 由三重服务端门禁保护；Provider runtime 为本地 live 研究注入 `0.15 USD` 上限，Production 保持原有行为。Vitest、Playwright 和 CI 显式覆盖为 fixture，避免 `.env.local` 改变回归语义。

**Tech Stack:** Next.js 16 App Router、React 19 Server Actions、Supabase Auth/Postgres、Inngest Dev Server、Vitest、Playwright、Node.js 22。

---

### Task 1: 固化 C1 范围和当前状态

**Files:**
- Create: `docs/superpowers/specs/2026-07-23-c1-local-live-research-design.md`
- Create: `docs/superpowers/plans/2026-07-23-c1-local-live-research-plan.md`
- Modify: `docs/roadmap.md`
- Modify: `PROJECT_STATUS.md`

- [x] **Step 1: 记录已确认方案**

写明 UI 日常操作默认真实 Provider、自动化测试固定 fixture、本地 anonymous Auth、固定 `3218/8288` 端口、`0.15 USD` 上限和 Production 冻结。

- [ ] **Step 2: 更新当前状态**

把 C1 标记为进行中，记录分支 `feat/c1-local-live-research`、当前用户可见目标和明确不做。

- [ ] **Step 3: 验证并提交计划**

Run:

```bash
git diff --check
rg -n "TODO|TBD|FIXME" docs/superpowers/specs/2026-07-23-c1-local-live-research-design.md docs/superpowers/plans/2026-07-23-c1-local-live-research-plan.md
```

Expected: 无空白错误；除检查说明外没有占位符。

Commit:

```bash
git add docs/superpowers/specs/2026-07-23-c1-local-live-research-design.md docs/superpowers/plans/2026-07-23-c1-local-live-research-plan.md docs/roadmap.md PROJECT_STATUS.md
git commit -m "docs(plan): 启动本地真实研究里程碑"
```

### Task 2: 建立本地环境准备与服务编排

**Files:**
- Create: `scripts/local-development.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Test: `tests/unit/local-development.test.ts`

- [ ] **Step 1: 写本地环境合约失败测试**

测试导入 `scripts/local-development.mjs` 的纯函数，覆盖：

```ts
expect(buildLocalEnvironment(existing, status)).toMatchObject({
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  SUPABASE_SERVICE_ROLE_KEY: "secret",
  LOCAL_DEV_AUTH_ENABLED: "true",
  INNGEST_DEV: "1",
});
expect(() => validateLocalLiveEnvironment({})).toThrow(
  "LOCAL_LIVE_RESEARCH_ENV_INCOMPLETE",
);
expect(serializeEnvironment(environment)).not.toContain("undefined");
```

同时读取 `package.json`，断言存在 `dev:local` 且 `inngest-cli` 固定版本。

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
npm run test:unit -- tests/unit/local-development.test.ts
```

Expected: FAIL，脚本、exports 和 `dev:local` 尚不存在。

- [ ] **Step 3: 实现最小环境准备函数**

`scripts/local-development.mjs` 使用 Node `util.parseEnv` 和 `supabase status -o json`：

```js
export const buildLocalEnvironment = (existing, status) => ({
  ...existing,
  NEXT_PUBLIC_SUPABASE_URL: requiredStatus(status, "API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requiredStatus(status, "PUBLISHABLE_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY || requiredStatus(status, "SERVICE_ROLE_KEY"),
  LOCAL_DEV_AUTH_ENABLED: "true",
  INNGEST_DEV: "1",
});
```

写入前拒绝符号链接；使用同目录临时文件、`0600` mode、rename 和最终 chmod。错误只包含稳定错误码或变量名，不包含值。

- [ ] **Step 4: 实现固定端口子进程编排**

脚本在 Node 22 下依次运行 Supabase start/status，然后并行启动：

```text
next dev --hostname 127.0.0.1 --port 3218
inngest-cli dev --no-discovery --port 8288 --sdk-url http://127.0.0.1:3218/api/inngest
```

启动前检查端口；任一子进程退出时终止另一个。添加固定 `inngest-cli@1.38.1` dev dependency 和 `npm run dev:local`。

- [ ] **Step 5: 运行聚焦测试并确认 GREEN**

Run:

```bash
npm run test:unit -- tests/unit/local-development.test.ts
```

Expected: PASS；未启动服务、未读取真实 Key、未发送网络 Provider 请求。

- [ ] **Step 6: 提交本地编排**

```bash
git add scripts/local-development.mjs package.json package-lock.json .env.example tests/unit/local-development.test.ts
git commit -m "feat(dev): 增加本地研究栈启动入口"
```

### Task 3: 增加只在本地可用的 anonymous 登录

**Files:**
- Create: `src/features/auth/local-development.ts`
- Modify: `src/features/auth/actions.ts`
- Modify: `src/app/[locale]/auth/login/page.tsx`
- Modify: `src/app/[locale]/auth/login/login.module.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Modify: `supabase/config.toml`
- Test: `tests/unit/local-development-auth.test.tsx`

- [ ] **Step 1: 写 auth gate 和 UI 失败测试**

覆盖 `development + true + loopback` 才允许：

```ts
expect(isLocalDevelopmentAuthEnabled({
  nodeEnv: "development",
  enabled: "true",
  supabaseUrl: "http://127.0.0.1:54321",
})).toBe(true);
```

并分别断言 Production、远端 Supabase、缺开关为 false。渲染中英文登录页，断言允许时存在“进入本地研究环境 / Enter local research workspace”，禁用时不存在。

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
npm run test:unit -- tests/unit/local-development-auth.test.tsx
```

Expected: FAIL，本地 gate、Action 和入口尚不存在。

- [ ] **Step 3: 实现三重 gate 与 Server Action**

`signInForLocalDevelopment` 在执行时重新读取环境并检查 gate，通过后调用：

```ts
const { error } = await supabase.auth.signInAnonymously();
if (error) throw new Error("LOCAL_DEV_AUTH_FAILED");
redirect(nextPath);
```

错误不得包含 Supabase 原始响应。`supabase/config.toml` 只开启本地 anonymous sign-in。

- [ ] **Step 4: 实现双语登录入口**

保留 GitHub OAuth 主入口；本地入口作为独立开发操作显示，并明确它只连接本机数据。按钮保持 44px 高，在 390px 宽度自然换行，不新增嵌套卡片。

- [ ] **Step 5: 运行聚焦测试并确认 GREEN**

Run:

```bash
npm run test:unit -- tests/unit/local-development-auth.test.tsx tests/unit/auth-session.test.ts tests/unit/auth-server-session.test.ts
```

Expected: PASS；Production gate false，现有 GitHub OAuth 与 redirect safety 不变。

- [ ] **Step 6: 提交本地认证**

```bash
git add src/features/auth src/app/[locale]/auth/login messages supabase/config.toml tests/unit/local-development-auth.test.tsx
git commit -m "feat(auth): 增加本地开发登录入口"
```

### Task 4: 为本地真实研究注入独立成本门禁

**Files:**
- Create: `src/providers/live/local-research-gate.ts`
- Modify: `src/providers/runtime.ts`
- Modify: `src/features/research/run-research-workflow.ts`
- Modify: `src/inngest/functions/run-research.ts`
- Modify: `.env.example`
- Test: `tests/unit/live-providers.test.ts`
- Test: `tests/unit/research-workflow.test.ts`
- Test: `tests/unit/inngest-research.test.ts`

- [ ] **Step 1: 写 local live gate 失败测试**

覆盖缺 mode、错误确认、非数字、零值、超过 `0.15`、缺 Key 均在创建 providers 前失败；有效环境返回：

```ts
expect(createResearchProviders({ environment })).toMatchObject({
  mode: "live",
  maxCostUsd: 0.15,
});
```

Production 忽略本地 gate 并返回 `maxCostUsd: 1`；fixture 同样保持 `1`。

- [ ] **Step 2: 写可注入工作流成本上限失败测试**

使用 fixture usage 和 `maxCostUsd: 0.05`，断言记录达到上限后返回 `RUN_COST_LIMIT_EXCEEDED`，且不开始下一次 Provider 调用。Inngest executor 测试断言 runtime 的 `maxCostUsd` 传给工作流。

- [ ] **Step 3: 运行测试并确认 RED**

Run:

```bash
npm run test:unit -- tests/unit/live-providers.test.ts tests/unit/research-workflow.test.ts tests/unit/inngest-research.test.ts
```

Expected: FAIL，本地完整研究 gate 和注入上限尚不存在。

- [ ] **Step 4: 实现最小 local live gate 与 runtime metadata**

新增精确确认 `I_CONFIRM_LOCAL_PAID_RESEARCH`，只接受 `0 < limit <= 0.15`。`createResearchProviders` 返回 `mode`、三类 provider 和 `maxCostUsd`。

- [ ] **Step 5: 实现工作流上限注入**

`runResearchWorkflow` 默认 `maxCostUsd=1`，校验后用该值替代两处硬编码比较；数据库 `estimated_cost_usd` 仍记录实际累计估算值并受现有 `<= 1` 约束。Inngest executor 在创建 providers 后把 runtime 上限传入工作流。

- [ ] **Step 6: 运行聚焦测试并确认 GREEN**

Run:

```bash
npm run test:unit -- tests/unit/live-providers.test.ts tests/unit/research-workflow.test.ts tests/unit/inngest-research.test.ts
```

Expected: PASS；现有 `1 USD` 测试继续通过，本地 `0.15 USD` 行为新增通过。

- [ ] **Step 7: 提交成本门禁**

```bash
git add src/providers src/features/research/run-research-workflow.ts src/inngest/functions/run-research.ts .env.example tests/unit/live-providers.test.ts tests/unit/research-workflow.test.ts tests/unit/inngest-research.test.ts
git commit -m "feat(provider): 限制本地真实研究成本"
```

### Task 5: 强制自动化 fixture 并完善本地文档

**Files:**
- Modify: `vitest.config.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/unit/provider-smoke-contract.test.ts`
- Modify: `README.md`
- Modify: `docs/deployment.md`
- Test: `tests/unit/local-development.test.ts`

- [ ] **Step 1: 写测试隔离失败合约**

断言 Vitest 和 Playwright 显式设置 `RESEARCH_PROVIDER_MODE=fixture`，常规脚本不包含本地或 smoke 确认令牌，专用 live smoke 仍不被默认配置收集。

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
npm run test:unit -- tests/unit/provider-smoke-contract.test.ts tests/unit/local-development.test.ts
```

Expected: FAIL，常规测试配置尚未显式覆盖本地 live mode。

- [ ] **Step 3: 实现 fixture 覆盖并更新文档**

Vitest `test.env` 和 Playwright `webServer.env` 固定 `RESEARCH_PROVIDER_MODE=fixture`。`test:e2e` 的 build 同样显式 fixture。README 增加 Node 22、`npm run dev:local`、固定 URL、服务端口和三种测试入口；部署文档把“本地默认 fixture”修正为“普通 `npm run dev` 默认 fixture，`dev:local` 受控 live”。

- [ ] **Step 4: 运行聚焦测试并确认 GREEN**

Run:

```bash
npm run test:unit -- tests/unit/provider-smoke-contract.test.ts tests/unit/local-development.test.ts
npm run check:provider-boundary
```

Expected: PASS；Provider 边界不允许新的客户端变量或未审核网络入口。

- [ ] **Step 5: 提交测试隔离与文档**

```bash
git add vitest.config.ts playwright.config.ts package.json tests/unit/provider-smoke-contract.test.ts tests/unit/local-development.test.ts README.md docs/deployment.md
git commit -m "test(provider): 隔离本地真实研究与自动化回归"
```

### Task 6: 配置本地运行、完成自动化门禁并交付验收

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/superpowers/plans/2026-07-23-c1-local-live-research-plan.md`
- Local only: `.env.local`

- [ ] **Step 1: 安全迁移已授权本地凭据**

把已授权的 Tavily、DeepSeek、百炼 Key 和 workspace ID 迁移到当前 worktree 的 `.env.local`，设置本地 live 三项变量；不得打印值。运行启动脚本后验证权限为 `0600`，并确认 Git status 不包含该文件。

- [ ] **Step 2: 运行完整 fixture-only 门禁**

Run:

```bash
npm run test:managed
```

Expected: Provider 边界、数据库、Schema lint、lint、typecheck、全部 unit、build 和 E2E 通过；没有真实 Provider 请求。

- [ ] **Step 3: 启动完整本地栈**

Run:

```bash
npm run dev:local
```

Expected: Supabase 可用，Next.js 监听 `127.0.0.1:3218`，Inngest 监听 `127.0.0.1:8288` 并同步一个函数；终端只显示服务状态和 URL，不显示密钥。

- [ ] **Step 4: Agent 浏览器预验收**

打开 `http://127.0.0.1:3218/zh/auth/login`，完成本地登录，创建一条无手动 URL 的低范围中文研究。等待最终状态并检查来源、Claim、Evidence、Source quote、运行日志、草稿报告和引文跳转。记录脱敏 run ID、搜索次数、来源数、Claim 数、Evidence 数、引文数和估算费用，不记录正文或 Provider payload。

- [ ] **Step 5: 更新状态并提交验收准备**

把 C1 更新为“自动化与 Agent 预验收通过，等待用户本地验收”，计划勾选已完成步骤。提交：

```bash
git add PROJECT_STATUS.md docs/superpowers/plans/2026-07-23-c1-local-live-research-plan.md
git commit -m "docs(status): 交付本地真实研究验收"
```

- [ ] **Step 6: 用户本地验收门禁**

向用户提供固定 URL 和以下清单：登录、创建中文研究、观察 queued/running/ready、检查来源与精确 quote、检查 Claim/Evidence 联动、打开报告并点击引文。用户明确通过前不 push、不创建 PR、不合并、不开始 C2。

## 终止条件

- C1 的代码和自动化门禁完成。
- Agent 的一条低范围真实研究完成且费用不高于本地上限，或失败原因已作为 C1 阻塞修复。
- 用户在同一本地服务上明确验收通过。
- 随后才进入唯一 Draft PR、独立 Claude 审核、GitHub CI 和 merge commit 收口；C1 收口后停止，不开始 C2。
