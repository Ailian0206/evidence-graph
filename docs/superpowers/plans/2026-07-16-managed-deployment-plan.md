# 托管部署实施计划

> **执行方式：** 当前会话按任务顺序执行。每个行为先验证 RED，再实现最小 GREEN；中间只做小粒度提交，不创建 PR。全部本地门禁和授权后的生产冒烟通过后，只创建一个里程碑 Draft PR。

**目标：** 把当前确定性 Evidence Graph 接入 Supabase Auth/Postgres/RLS/pgvector、Inngest、Sentry、Vercel Analytics 和 Vercel 部署门禁，同时保证日常测试不调用真实 OpenAI 或 Tavily。

**架构：** 保留现有纯 TypeScript 领域模型和 Provider 接口，在外层增加托管服务适配器。Supabase 迁移和 RLS 是数据隔离的最终约束；Next.js Server Component、Server Action 和 Route Handler 每次访问时仍执行用户与项目授权校验，`proxy.ts` 只负责语言路由和刷新 Supabase 会话，不能作为唯一授权层。Inngest 只接收经过 Zod 校验且包含 `ownerId/projectId/runId` 的事件，执行前再次读取项目所有权；真实 Provider 仍由专用确认门禁控制。

**技术栈：** Next.js 16 App Router、TypeScript、Zod、Supabase JS/SSR/CLI、Postgres RLS、pgvector、pgTAP、Inngest、Sentry、Vercel Analytics、Vitest、Testing Library、Playwright。

---

## 已确认边界

- `/zh/app/research/demo` 和 `/en/app/research/demo` 继续作为无需登录、只读且确定性的公开示例。
- `/[locale]/app`、`/[locale]/app/research/new` 和非 `demo` 工作台必须登录。
- Service Role、Inngest Signing Key、Sentry Auth Token、OpenAI Key 和 Tavily Key 不进入客户端 bundle，也不写入仓库。
- 缺少托管环境变量时，公开作品集、公开示例、本地 build 和常规测试仍可运行；只有进入托管功能时返回明确的未配置状态。
- 本模块不实现真实 OpenAI/Tavily Provider，不执行付费请求，不购买域名，不创建付费套餐。
- 创建 Vercel、Supabase、Inngest、Sentry 资源，配置 GitHub OAuth，写入真实密钥及运行生产冒烟测试前必须取得用户明确授权。

## 文件结构

- `src/config/managed-env.ts`：集中解析公开变量、服务端变量和一次性生产冒烟确认令牌。
- `supabase/migrations/*.sql`：扩展、表、约束、触发器、索引、RLS 和公开报告读取函数。
- `supabase/tests/*.sql`：跨租户隔离、级联删除、精确引用和公开快照 pgTAP 测试。
- `src/lib/supabase/{browser,server,admin,proxy}.ts`：按运行环境隔离 Supabase 客户端。
- `src/features/auth/*`：登录、回调、退出和服务端用户授权边界。
- `src/features/projects/supabase-project-repository.ts`：项目 CRUD 与月度用量持久化适配器。
- `src/inngest/*`、`src/app/api/inngest/route.ts`：事件 Schema、客户端、函数和 webhook。
- `src/instrumentation.ts`、`src/instrumentation-client.ts`、`sentry.*.config.ts`：可选监控初始化。
- `scripts/verify-managed-env.mjs`、`scripts/smoke-production.mjs`：环境校验和带确认门禁的生产冒烟。
- `docs/deployment.md`：中文账号配置、部署、回滚、备份与密钥轮换步骤。

### 任务 1：建立依赖和环境变量契约

**文件：**

- 修改：`package.json`
- 修改：`package-lock.json`
- 创建：`.env.example`
- 创建：`src/config/managed-env.ts`
- 创建：`tests/unit/managed-env.test.ts`

- [x] **步骤 1：编写环境变量 RED 测试**

测试覆盖：公开 Supabase URL/Publishable Key 成对出现；Service Role 只能由服务端读取；没有变量时返回 `configured: false` 而不是让公开 build 失败；生产冒烟必须同时满足 `ALLOW_PRODUCTION_SMOKE=YES_I_ACCEPT_REAL_WRITES` 和 HTTPS `PRODUCTION_BASE_URL`。

```ts
expect(readManagedRuntimeStatus({})).toEqual({
  supabasePublic: false,
  supabaseAdmin: false,
  inngest: false,
  sentry: false,
});

expect(() =>
  requireProductionSmokeEnv({
    ALLOW_PRODUCTION_SMOKE: "wrong",
    PRODUCTION_BASE_URL: "https://example.com",
  }),
).toThrow("PRODUCTION_SMOKE_NOT_CONFIRMED");
```

- [x] **步骤 2：运行测试确认 RED**

运行：`npm run test:unit -- tests/unit/managed-env.test.ts`

预期：因 `@/config/managed-env` 不存在而失败。

- [x] **步骤 3：安装锁定依赖**

运行：

```bash
npm install @supabase/supabase-js@2.110.6 @supabase/ssr@0.12.3 inngest@4.13.0 @sentry/nextjs@10.66.0 @vercel/analytics@2.0.1
npm install --save-dev supabase@2.109.1
```

- [x] **步骤 4：实现惰性环境解析**

`readManagedRuntimeStatus` 只报告能力；`requireSupabasePublicEnv`、`requireSupabaseAdminEnv` 和 `requireProductionSmokeEnv` 在实际使用对应能力时才抛出稳定错误码。客户端文件不得导入服务端 Schema，不得使用动态 `process.env[name]` 读取 `NEXT_PUBLIC_*`。

- [x] **步骤 5：验证 GREEN 和客户端密钥边界**

运行：

```bash
npm run test:unit -- tests/unit/managed-env.test.ts
rg -n "SUPABASE_SERVICE_ROLE_KEY|SENTRY_AUTH_TOKEN|INNGEST_SIGNING_KEY" src --glob '*.{ts,tsx}'
```

预期：测试通过；解析模块不直接读取敏感 `process.env`，后续实际读取由明确标记为 `server-only` 的 adapter 负责。

- [x] **步骤 6：提交**

```bash
git add package.json package-lock.json .env.example src/config/managed-env.ts tests/unit/managed-env.test.ts
git commit -m "build(deploy): 建立托管环境契约"
```

### 任务 2：建立 Supabase 数据模型、约束和 pgvector

**文件：**

- 创建：`supabase/config.toml`
- 创建：`supabase/migrations/20260716000100_managed_research_schema.sql`
- 创建：`supabase/seed.sql`
- 创建：`supabase/tests/01_schema_constraints.sql`
- 修改：`package.json`

- [x] **步骤 1：初始化本地 Supabase 配置**

运行：`npx supabase init`

保留 CLI 生成的本地端口配置，不连接远端项目。

- [x] **步骤 2：先写数据库约束 RED 测试**

pgTAP 必须验证：

1. `vector` 扩展存在，`source_chunks.embedding` 为 1536 维向量。
2. 同一项目内 `canonical_url`、`content_hash`、`normalized_key` 不能重复；不同项目允许相同内容哈希。
3. Evidence Link 的 Claim 与 Chunk 必须属于同一项目。
4. `quote` 不是 Chunk 文本精确子串时插入失败。
5. 删除项目级联删除所有来源、Chunk、Claim、关系、报告、运行日志和审计事件。
6. 每个 owner 只能存在一个 `queued/running` 运行。

- [x] **步骤 3：运行数据库测试确认 RED**

运行：

```bash
npx supabase start -x studio,imgproxy,edge-runtime,gotrue,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,supavisor,vector
npx supabase test db --local supabase/tests/01_schema_constraints.sql
```

预期：目标表或约束不存在，测试失败。

- [x] **步骤 4：实现迁移**

迁移创建 `profiles`、`projects`、`research_runs`、`sources`、`source_chunks`、`claims`、`evidence_links`、`claim_relations`、`workflow_checkpoints`、`run_logs`、`reports`、`usage_monthly`、`audit_events`。所有子表包含可验证的 `project_id` 复合外键；`sources` 使用 `(project_id, content_hash)` 唯一约束；Evidence Link 触发器验证精确 Quote；向量索引使用 HNSW `vector_cosine_ops`。

- [x] **步骤 5：验证 GREEN**

运行：

```bash
npx supabase db reset
npx supabase test db --local supabase/tests/01_schema_constraints.sql
```

预期：全部 pgTAP 用例通过。

- [x] **步骤 6：提交**

```bash
git add package.json supabase
git commit -m "feat(database): 建立研究数据模型"
```

### 任务 3：用 RLS 固化跨租户隔离和公开读取

**文件：**

- 修改：`supabase/migrations/20260716000100_managed_research_schema.sql`
- 创建：`supabase/tests/02_rls_isolation.sql`

- [ ] **步骤 1：编写 RLS RED 测试**

测试创建用户 A、用户 B 和匿名角色，设置 `request.jwt.claims` 后验证：A 不能读取、修改或删除 B 的项目及任何子表；B 不能通过伪造 `owner_id/project_id` 写入 A 的项目；匿名用户只能通过只读函数取得 `visibility = 'public'` 且 `published_at is not null` 的报告快照，不能读取私有来源正文、运行日志和成本。

- [ ] **步骤 2：运行测试确认 RED**

运行：`npx supabase test db supabase/tests/02_rls_isolation.sql`

预期：缺少策略或公开读取函数导致失败。

- [ ] **步骤 3：实现最小 RLS 策略**

所有用户数据表启用并强制 RLS。`projects` 直接比较 `owner_id = auth.uid()`；子表通过项目所有权 `exists` 校验；`profiles` 和 `usage_monthly` 比较主键 owner；公开报告只通过 `security definer` 函数返回经过限定的报告与引用快照，函数固定 `search_path` 且不返回 Service Role 数据。

- [ ] **步骤 4：验证 GREEN**

运行：

```bash
npx supabase db reset
npx supabase test db
```

预期：Schema 和 RLS 两组测试全部通过。

- [ ] **步骤 5：提交**

```bash
git add supabase/migrations/20260716000100_managed_research_schema.sql supabase/tests/02_rls_isolation.sql
git commit -m "feat(database): 增加跨租户访问策略"
```

### 任务 4：接入 Supabase SSR 和 GitHub 登录

**文件：**

- 创建：`src/lib/supabase/browser.ts`
- 创建：`src/lib/supabase/server.ts`
- 创建：`src/lib/supabase/admin.ts`
- 创建：`src/lib/supabase/proxy.ts`
- 创建：`src/features/auth/session.ts`
- 创建：`src/features/auth/actions.ts`
- 创建：`src/app/auth/callback/route.ts`
- 创建：`src/app/[locale]/auth/login/page.tsx`
- 修改：`src/app/[locale]/app/research/[id]/page.tsx`
- 修改：`src/proxy.ts`
- 修改：`messages/zh.json`
- 修改：`messages/en.json`
- 创建：`tests/unit/auth-session.test.ts`
- 创建：`tests/e2e/auth-boundary.spec.ts`

- [ ] **步骤 1：编写服务端授权 RED 测试**

通过可注入的 `getUser` 依赖验证：缺少用户时生成保留 locale 与目标路径的登录重定向；已登录时返回最小 `{ id, email }` 会话；Provider 错误不得被当成匿名静默吞掉。

```ts
await expect(requireUser({ locale: "zh", getUser: async () => null })).rejects.toMatchObject({
  digest: expect.stringContaining("/zh/auth/login"),
});
```

- [ ] **步骤 2：运行测试确认 RED**

运行：`npm run test:unit -- tests/unit/auth-session.test.ts`

预期：Auth 模块不存在。

- [ ] **步骤 3：实现客户端和会话刷新**

使用 `@supabase/ssr` 的 `createBrowserClient` 与 `createServerClient`。Server Client 使用 Next 16 异步 `cookies()`；Proxy Client 只刷新 Cookie。`src/lib/supabase/admin.ts` 首行导入 `server-only`，只读取 Service Role。登录 action 使用 GitHub OAuth；callback Route Handler 交换 code 后只允许站内相对 `next` 路径。

- [ ] **步骤 4：实现双层授权**

`proxy.ts` 保留现有非法 locale 404 和 `next-intl` 行为，并刷新 Supabase 会话。`/[locale]/app/page.tsx`、新建研究页和数据操作各自在离数据最近的位置调用 `requireUser`；工作台页面只对 `id !== "demo"` 调用授权，保证公开示例仍可访问。Proxy 不能作为唯一授权边界。

- [ ] **步骤 5：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/auth-session.test.ts
npx playwright test tests/e2e/auth-boundary.spec.ts tests/e2e/evidence-workspace.spec.ts
npm run build
```

预期：未配置环境时公开示例正常；受保护页面显示明确配置状态或登录入口；配置测试客户端时未登录访问被重定向；build 不要求真实密钥。

- [ ] **步骤 6：提交**

```bash
git add src/lib/supabase src/features/auth src/app/auth src/app/[locale]/auth src/app/[locale]/app/research/[id]/page.tsx src/proxy.ts messages tests
git commit -m "feat(auth): 接入 Supabase GitHub 登录"
```

### 任务 5：实现项目持久化、Dashboard 和新建研究

**文件：**

- 创建：`src/features/projects/project-store.ts`
- 创建：`src/features/projects/supabase-project-repository.ts`
- 创建：`src/features/projects/actions.ts`
- 创建：`src/app/[locale]/app/page.tsx`
- 创建：`src/app/[locale]/app/research/new/page.tsx`
- 创建：`src/components/projects/project-dashboard.tsx`
- 创建：`src/components/projects/new-research-form.tsx`
- 创建：`tests/unit/supabase-project-repository.test.ts`
- 创建：`tests/e2e/project-dashboard.spec.ts`
- 修改：`messages/zh.json`
- 修改：`messages/en.json`

- [ ] **步骤 1：编写 Repository RED 测试**

使用可注入的 Supabase query adapter 验证：所有 list/get/update/delete 都携带当前 `ownerId`；数据库返回空结果统一映射为 `PROJECT_NOT_FOUND`；创建项目使用 Zod 校验标题、问题和语言；月度次数达到 3 时在写入前返回 `MONTHLY_RUN_LIMIT_EXCEEDED`。

- [ ] **步骤 2：运行测试确认 RED**

运行：`npm run test:unit -- tests/unit/supabase-project-repository.test.ts`

预期：持久化适配器不存在。

- [ ] **步骤 3：实现最小持久化边界**

定义与现有内存仓库一致的异步 `ProjectStore` 接口。Supabase adapter 将 snake_case 数据显式映射到领域类型，不把数据库 row 直接泄漏给组件；每个 mutation 在 Server Action 内重新执行 `requireUser` 和 Zod 解析，再调用 adapter。

- [ ] **步骤 4：实现 Dashboard 和新建研究页面**

Dashboard 展示当前用户项目、状态和最近更新时间；新建研究只收集标题、问题、语言及最多 5 个 URL，不触发真实 Provider。中英文文案都进入 messages 文件。表单错误、空状态和 pending 状态必须可访问。

- [ ] **步骤 5：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/supabase-project-repository.test.ts
npx playwright test tests/e2e/project-dashboard.spec.ts
```

预期：项目 CRUD、跨用户 404、月度限制和双语页面通过。

- [ ] **步骤 6：提交**

```bash
git add src/features/projects src/app/[locale]/app src/components/projects messages tests
git commit -m "feat(projects): 实现托管项目工作区"
```

### 任务 6：接入 Inngest 事件和确定性工作流入口

**文件：**

- 创建：`src/inngest/events.ts`
- 创建：`src/inngest/client.ts`
- 创建：`src/inngest/authorize-run.ts`
- 创建：`src/inngest/functions/run-research.ts`
- 创建：`src/app/api/inngest/route.ts`
- 创建：`tests/unit/inngest-research.test.ts`
- 创建：`tests/e2e/inngest-route.spec.ts`

- [ ] **步骤 1：编写事件与所有权 RED 测试**

测试验证事件必须包含 `ownerId/projectId/runId`；函数执行前查询项目并核对三者；不匹配时抛出不可重试的 `RUN_PROJECT_MISMATCH`；相同事件使用 `runId` 作为幂等 key；日常测试只注入 fixture providers。

- [ ] **步骤 2：运行测试确认 RED**

运行：`npm run test:unit -- tests/unit/inngest-research.test.ts`

预期：Inngest 模块不存在。

- [ ] **步骤 3：实现最小 Inngest 适配器**

注册 `evidence/research.requested` 事件。函数并发键使用 owner ID，单用户并发为 1，重试最多 3 次；先执行所有权检查，再在 `step.run` 内调用现有确定性工作流边界。没有真实 Provider 确认变量时只能使用 fixtures，不能导入未来的 OpenAI/Tavily adapter。

- [ ] **步骤 4：实现 Route Handler**

使用 Inngest 官方 `serve` App Router 适配器导出 `GET/POST/PUT`。Route Handler 不挂 locale，不缓存，不返回环境变量。

- [ ] **步骤 5：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/inngest-research.test.ts
npx playwright test tests/e2e/inngest-route.spec.ts
rg -n "api\.openai\.com|api\.tavily\.com|OPENAI_API_KEY|TAVILY_API_KEY" src/inngest src/app/api
```

预期：事件、所有权和路由测试通过；安全扫描无真实 Provider 实现。

- [ ] **步骤 6：提交**

```bash
git add src/inngest src/app/api/inngest tests
git commit -m "feat(workflow): 接入 Inngest 运行入口"
```

### 任务 7：增加 Sentry、Analytics 和安全响应头

**文件：**

- 创建：`src/instrumentation.ts`
- 创建：`src/instrumentation-client.ts`
- 创建：`sentry.server.config.ts`
- 创建：`sentry.edge.config.ts`
- 创建：`src/app/global-error.tsx`
- 修改：`src/app/[locale]/layout.tsx`
- 修改：`next.config.ts`
- 创建：`tests/unit/observability-config.test.ts`
- 创建：`tests/e2e/security-headers.spec.ts`

- [ ] **步骤 1：编写可选监控 RED 测试**

验证缺少 DSN 时初始化函数不发送事件且 build 不失败；设置测试 DSN 时 Sentry 只接收脱敏后的错误上下文；Analytics 组件存在但不采集用户研究问题、来源正文和运行成本。

- [ ] **步骤 2：运行测试确认 RED**

运行：`npm run test:unit -- tests/unit/observability-config.test.ts`

预期：监控配置不存在。

- [ ] **步骤 3：实现 Next 16 instrumentation**

按仓库内 Next 16 文档使用 `src/instrumentation.ts` 和 `src/instrumentation-client.ts`；Node/Edge 配置按 `NEXT_RUNTIME` 条件导入。Sentry `beforeSend` 删除 email、GitHub 用户名、研究问题、正文、quote 和 Provider payload。`withSentryConfig` 不在缺少 auth token 时上传 source map。

- [ ] **步骤 4：增加 Analytics 和安全 Header**

在根 layout 添加 Vercel Analytics。`next.config.ts` 添加 `X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy` 和 `frame-ancestors` 等稳定 Header；不得用会破坏 Next hydration 的临时 CSP。

- [ ] **步骤 5：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/observability-config.test.ts
npx playwright test tests/e2e/security-headers.spec.ts
npm run build
```

预期：无真实 DSN 的 CI 通过，安全 Header 可观测，公开页面无回归。

- [ ] **步骤 6：提交**

```bash
git add src/instrumentation.ts src/instrumentation-client.ts sentry.*.config.ts src/app next.config.ts tests
git commit -m "feat(observability): 增加监控与安全门禁"
```

### 任务 8：把数据库门禁接入 CI

**文件：**

- 修改：`.github/workflows/ci.yml`
- 修改：`package.json`
- 创建：`scripts/check-provider-boundary.mjs`

- [ ] **步骤 1：先验证现有 CI 不执行数据库测试**

运行：`rg -n "supabase|test:db|provider-boundary" .github/workflows/ci.yml package.json`

预期：无匹配或缺少完整门禁。

- [ ] **步骤 2：增加稳定脚本**

新增 `test:db`、`test:managed` 和 `check:provider-boundary`。Provider 扫描检查真实端点、敏感变量的客户端引用和 fixture 之外的网络 Provider；数据库命令使用锁定的本地 CLI，不连接远端。

- [ ] **步骤 3：增加独立 database CI job**

保持现有 quality job 不变，新增 database job 启动本地 Supabase、执行 reset 和 pgTAP，最后无论成功失败都停止本地容器。两个 job 都通过才允许 PR 合并。

- [ ] **步骤 4：本地验证**

运行：

```bash
npm run check:provider-boundary
npm run test:db
npm run test:ci
```

预期：Provider 扫描、全部 pgTAP、lint、typecheck、unit、build 和 E2E 通过。

- [ ] **步骤 5：提交**

```bash
git add .github/workflows/ci.yml package.json package-lock.json scripts/check-provider-boundary.mjs
git commit -m "ci: 增加托管数据库门禁"
```

### 任务 9：增加部署文档和生产冒烟确认门禁

**文件：**

- 创建：`docs/deployment.md`
- 创建：`scripts/verify-managed-env.mjs`
- 创建：`scripts/smoke-production.mjs`
- 创建：`tests/unit/production-smoke-gate.test.ts`
- 修改：`package.json`
- 修改：`README.md`

- [ ] **步骤 1：编写生产冒烟 RED 测试**

验证没有确认令牌时脚本在任何网络请求前退出；base URL 必须 HTTPS 且不能是 localhost；默认冒烟只检查公开首页、公开示例、Auth 重定向、Inngest 签名拒绝和安全 Header，不运行真实研究。

- [ ] **步骤 2：运行测试确认 RED**

运行：`npm run test:unit -- tests/unit/production-smoke-gate.test.ts`

预期：脚本和门禁不存在。

- [ ] **步骤 3：实现脚本和中文文档**

`docs/deployment.md` 明确 Vercel Git Import、Supabase 迁移、GitHub OAuth callback、Inngest、Sentry、Preview/Production 变量作用域、备份恢复、密钥轮换和回滚步骤。真实研究冒烟单独要求 `ALLOW_PAID_PROVIDER_SMOKE=YES_I_ACCEPT_PROVIDER_COST`，并在输出中显示最高 1 美元成本上限。

- [ ] **步骤 4：验证无网络默认行为**

运行：

```bash
npm run verify:managed-env
npm run smoke:production
```

预期：没有真实环境时，环境校验列出缺项；生产冒烟在发送请求前以 `PRODUCTION_SMOKE_NOT_CONFIRMED` 退出。

- [ ] **步骤 5：提交**

```bash
git add docs/deployment.md scripts package.json README.md tests/unit/production-smoke-gate.test.ts
git commit -m "docs(deploy): 增加上线与回滚流程"
```

### 任务 10：授权后的托管资源与生产验证

**前置门禁：** 用户明确授权创建或连接 Vercel、Supabase、Inngest、Sentry 资源，并提供 GitHub OAuth 与域名处理方式。未获授权时停在本任务之前，但前九项本地开发继续完成。

- [ ] **步骤 1：创建免费层资源并记录非敏感标识**

只通过各平台官方集成创建资源；不升级付费套餐。密钥只写入平台环境变量和本地忽略的 `.env.local`，不进入命令日志、截图、测试报告或 Git。

- [ ] **步骤 2：应用迁移和 OAuth 配置**

先应用 Preview，再验证 RLS，最后应用 Production。OAuth callback 只允许已确认的 Preview 与 Production URL。

- [ ] **步骤 3：运行不含付费 Provider 的生产冒烟**

运行：

```bash
ALLOW_PRODUCTION_SMOKE=YES_I_ACCEPT_REAL_WRITES \
PRODUCTION_BASE_URL="$PRODUCTION_BASE_URL" \
npm run smoke:production
```

预期：登录、项目 CRUD、跨租户拒绝、公开示例、Inngest webhook、安全 Header 和受控 Sentry 异常通过。

- [ ] **步骤 4：执行回滚和备份恢复演练**

固定成功 Vercel Deployment，回滚到该版本并重新执行只读 smoke；在 Supabase 预演环境验证备份恢复步骤，不删除 Production 数据。

- [ ] **步骤 5：提交非敏感部署结果**

```bash
git add docs/deployment.md PROJECT_STATUS.md
git commit -m "docs(status): 记录托管部署验证"
```

### 任务 11：完成里程碑门禁并创建唯一 Draft PR

- [ ] **步骤 1：检查差异与敏感信息**

运行：

```bash
git diff --check main...HEAD
git status --short
git log --oneline main..HEAD
npm run check:provider-boundary
rg -n "sk-[A-Za-z0-9]{20,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY" . --glob '!node_modules/**' --glob '!package-lock.json'
```

- [ ] **步骤 2：运行完整本地门禁**

运行：

```bash
npm run test:db
npm run test:ci
```

预期：数据库约束/RLS、lint、typecheck、全部单元测试、production build 和全部 E2E 通过。

- [ ] **步骤 3：更新项目状态**

在 `PROJECT_STATUS.md` 记录本地验证数量、Provider 调用状态、外部资源状态和剩余授权项。

- [ ] **步骤 4：推送分支并只创建一个 Draft PR**

```bash
git push -u origin feat/managed-deployment
gh pr create --draft --base main --head feat/managed-deployment --title "feat: 完成托管部署里程碑" --body-file /tmp/evidence-graph-managed-deployment-pr.md
```

- [ ] **步骤 5：按自动审核流程闭环**

运行独立 Claude 审核；有问题就在原 PR 修复、验证、提交并重审。当前 head 审核 `pass` 且 CI 成功后使用 merge commit 合并；不创建第二个 PR。
