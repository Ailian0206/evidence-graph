# Evidence Graph 托管部署手册

本文档用于本地开发与 Vercel Production 两层部署。Evidence Graph 是个人练习与作品集项目，部署目标是让公开演示和已有产品流程稳定可用，不建设预发布、多区域、高可用或复杂发布编排。所有资源创建、账号连接、远端迁移和真实请求都必须先通过 `AGENT.md` 的授权门禁。

## 1. 部署边界

- 自动化回归只使用 fixture providers，不调用 Tavily、DeepSeek 或阿里云百炼。
- 不把 `.env.local`、Service Role、Signing Key、Sentry Auth Token、Provider 响应或包含私人来源正文的报告提交到 Git。
- `npm run dev:local` 使用 fixture Provider，`npm run dev:local:live` 使用受控真实 Provider；两者都只编排本地 Next.js 与 Inngest，并连接托管开发 Supabase。Vercel 只配置 Production，不维护 Preview 环境变量或预发布服务。
- Vercel 已关闭 Preview 自动部署；`main` 只承担日常集成，只有 `release` 更新才自动部署 Production。
- 默认生产冒烟不创建项目、不运行研究、不调用付费 Provider。
- 真实 Provider 冒烟必须同时设置 `RESEARCH_PROVIDER_MODE=live`、`ALLOW_PAID_PROVIDER_SMOKE=I_CONFIRM_PAID_PROVIDER_CALLS` 和不高于 `0.10 USD` 的显式成本上限；未取得当次授权时不得执行。

## 2. 本地门禁

使用 Node.js 22，在推送托管部署分支前运行：

```bash
nvm use
npm ci
npm run check:provider-boundary
npm run test:ci
npm run test:managed
```

`test:managed` 先通过 `test:db:hosted` 核对 CLI link 与允许的 Project Ref，再对托管开发数据库运行事务内 pgTAP 和 Schema lint；测试文件以 `rollback` 结束，不保留 fixture 行，也不执行远端 reset、迁移或 seed。CI 的独立 database job 使用 `test:db:ci` 在 GitHub runner 重建 migration 链，并在成功或失败后删除测试数据卷。本机不启动 Supabase Docker。

### 2.1 本地真实研究

`npm run dev:local` 使用 fixture Provider，不需要 Provider 凭据。`npm run dev:local:live` 要求 `.env.local` 包含四项 Provider 凭据，并设置以下门禁：

```bash
RESEARCH_PROVIDER_MODE=live
ALLOW_LOCAL_LIVE_RESEARCH=I_CONFIRM_LOCAL_PAID_RESEARCH
LOCAL_LIVE_RESEARCH_COST_LIMIT_USD=0.15
```

脚本只接受 Node.js 22，使用固定的 `127.0.0.1:3218` 启动 Next.js，在 `127.0.0.1:8288` 启动单 worker、持久化的 Inngest。它只校验托管 Supabase URL、Project Ref allow-list 和 `.env.local` 权限，不改写环境文件。完整 live UI 研究使用真实 Tavily、DeepSeek 和阿里云百炼，并限制为 4 个来源、40,000 个正文字符、20 个 embedding 批次和 `0.15 USD`。

`npm run test:unit`、`npm run test:e2e` 和 `npm run test:ci` 不执行付费 Provider 外呼。`test:managed` 额外连接托管开发数据库运行事务测试，但 Provider 仍保持 fixture 语义。

## 3. 资源创建顺序

### 3.0 当前资源状态

| 服务 | 环境或标识 | 状态 |
| --- | --- | --- |
| Supabase | 当前托管开发数据库，东京 | C1-C6 复用；四条仓库迁移已应用，GitHub Provider 和 Redirect 已配置 |
| GitHub OAuth | 当前托管开发 App | 本地和历史 Production 回调已配置 |
| Inngest | Production 冻结 | 历史应用 `evidence-graph` 已同步；本地使用 Dev Server |
| Sentry | EU 组织 `ailian0206`，项目 `evidence-graph` | DSN 已配置；Source Map Token 保持可选未配置 |
| Vercel | `https://evidence-graph-pi.vercel.app` | Hobby Production 已 Ready；Production Branch 为 `release`，Preview 自动部署已关闭 |

此前创建的 Supabase Preview `vooexhwkqzymltwewcqc`、GitHub OAuth Preview App `3734029` 和 Inngest Preview `preview-e7881f94` 不再接入 Vercel，也不承担发布门禁。它们保持闲置，删除前需单独确认。

上述表格只记录非敏感标识。Client Secret、Service Role、Event Key、Signing Key 和 DSN 的值不得写入文档或 Git。

### 3.1 Supabase

1. C1-C6 期间当前托管项目作为开发数据库；仓库 migration 链继续是 Schema 事实来源。
2. 本地通过官方 CLI 登录并链接该开发项目，同时在 `.env.local` 的 `LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF` 中显式允许同一个 ref。
3. 日常门禁只运行：

```bash
npm run test:db:hosted
```

4. GitHub Actions 的 database job 才使用本地 Postgres 重建 migration 链并运行 pgTAP。不得对托管开发项目执行 `supabase config push`、远端 reset、seed 或日常 migration push。
5. Production 数据库迁移冻结到 C6 通过且用户明确授权的 R1；届时只前向应用已在开发库与 CI 验证的迁移。
6. Service Role 只用于本地服务端和受控维护脚本，不进入客户端、Git、日志或 PR。

### 3.2 GitHub OAuth

1. 创建 GitHub OAuth App。Authorization callback URL 使用 Supabase 提供的 `https://<project-ref>.supabase.co/auth/v1/callback`。
2. 在 Supabase Auth Providers 中启用 GitHub，并写入 OAuth Client ID 与 Client Secret。
3. Supabase Site URL 设置为当前环境的站点 URL。
4. Redirect URL allow list 保留 Production 地址，并精确加入 `http://127.0.0.1:3218/auth/callback`；不加入 Vercel 临时 Preview URL。
5. 验证登录回调只返回 `/<locale>/app` 及其子路径，不能跳转到站外地址。

### 3.3 Inngest

1. 本地开发使用 Inngest Dev Server；线上只维护 Production 环境。
2. 将 Production 同步地址配置为 `https://<production-host>/api/inngest`。
3. 取得 Production Event Key 与 Signing Key，并只写入 Vercel Production 变量。
4. 同步后确认函数 `run-managed-research` 的 owner 并发为 1、重试次数为 3、幂等键为 `runId`。
5. Production 执行器强制使用 Tavily、DeepSeek 和阿里云百炼，不会静默回退 fixtures；本地 `dev:local` 使用 fixtures，`dev:local:live` 使用受控 live。

### 3.4 Sentry

1. 创建 Next.js 项目并取得 DSN，只配置到 Production；本地默认不发送事件。
2. 需要 Source Map 时创建最小权限 Auth Token，并同时配置组织名和项目名；缺少完整三项时构建会自动跳过上传。
3. 不启用 Session Replay、用户输入录制或研究正文附件。
4. 首次验证只发送受控异常，确认 email、GitHub 用户名、研究问题、来源正文、quote 和 Provider payload 已被脱敏。

### 3.5 Vercel

1. 从 GitHub 导入仓库，使用 Node.js 22、`npm ci` 和 `npm run build`。
2. 日常开发和集成提交推送到 `main`，不触发 Vercel 部署。
3. 发布前确认 `main` 的完整门禁通过，再把 `main` 快进或合并到 `release`；只有 `release` 更新才由 Git 集成部署 Production。
4. Vercel 项目级关闭 Preview 自动部署，不为功能分支、PR 或 `main` 创建 Preview。
5. 不在构建日志、部署说明或 PR 中粘贴密钥值。

## 4. 环境变量作用域

| 变量                                   | 本地开发               | Production       | 客户端可见 | 说明                   |
| -------------------------------------- | ---------------------- | ---------------- | ---------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | 托管开发项目 URL        | Production 值    | 是         | Supabase 项目 URL      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 托管开发公开 Key        | Production 值    | 是         | 公开 Publishable Key   |
| `SUPABASE_SERVICE_ROLE_KEY`            | 托管开发 Service Role   | Production 值    | 否         | 仅用于本地服务端       |
| `LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF` | 托管开发项目 ref      | 不配置           | 否         | 本地 link allow-list   |
| `INNGEST_EVENT_KEY`                    | 默认不配置              | Production 值    | 否         | Inngest 事件发送       |
| `INNGEST_SIGNING_KEY`                  | 默认不配置              | Production 值    | 否         | Inngest webhook 验签   |
| `NEXT_PUBLIC_SENTRY_DSN`               | 默认不配置              | Production 值    | 是         | Sentry 运行时上报      |
| `SENTRY_AUTH_TOKEN`                    | 不配置                  | 可选             | 否         | 构建期 Source Map 上传 |
| `SENTRY_ORG`                           | 不配置                  | 可选             | 否         | Sentry 组织名          |
| `SENTRY_PROJECT`                       | 不配置                  | 可选             | 否         | Sentry 项目名          |
| `PRODUCTION_BASE_URL`                  | 不配置                  | 冒烟终端临时设置 | 否         | 生产站点 HTTPS Origin  |
| `ALLOW_PRODUCTION_SMOKE`               | 不配置                  | 冒烟终端临时设置 | 否         | 防止误触发生产请求     |
| `TAVILY_API_KEY`                       | `dev:local:live` 必需    | Production 值    | 否         | Tavily Search/Extract  |
| `DEEPSEEK_API_KEY`                     | `dev:local:live` 必需    | Production 值    | 否         | DeepSeek 结构化生成    |
| `BAILIAN_API_KEY`                      | `dev:local:live` 必需    | Production 值    | 否         | 百炼 Embedding         |
| `BAILIAN_WORKSPACE_ID`                 | `dev:local:live` 必需    | Production 值    | 否         | 百炼北京地域工作空间   |
| `RESEARCH_PROVIDER_MODE`               | live profile 设为 live  | 无需配置         | 否         | fixture profile 启动时覆盖 |
| `ALLOW_LOCAL_LIVE_RESEARCH`            | `dev:local:live` 必需    | 不配置           | 否         | 本地完整研究确认令牌   |
| `LOCAL_LIVE_RESEARCH_COST_LIMIT_USD`   | `dev:local:live` 必需    | 不配置           | 否         | 本地完整研究上限，至多 0.15 |
| `ALLOW_PAID_PROVIDER_SMOKE`            | 默认不配置              | 不持久配置       | 否         | 专用冒烟精确确认令牌   |
| `PAID_PROVIDER_SMOKE_COST_LIMIT_USD`   | 默认不配置              | 不持久配置       | 否         | 专用冒烟上限，至多 0.10 |

`.env.local` 必须保持 Git 忽略并设为 `0600`。本地启动前可在不打印变量值的前提下检查：

```bash
node --env-file-if-exists=.env.local scripts/local-development.mjs --profile=fixture --check
```

不要上传或提交 `.env.local`。Vercel Preview 环境保持无托管变量，Production 变量在 C6 前不修改。

## 5. 生产冒烟

默认脚本只执行以下检查：

1. `/zh` 返回 200，并包含稳定安全 Header。
2. `/zh/app/research/demo` 公开示例返回 200。
3. 未登录访问 `/zh/app` 重定向到本地化登录页。
4. 未签名的 `POST /api/inngest` 被 401 或 403 拒绝。

必须显式确认后才能发送请求：

```bash
ALLOW_PRODUCTION_SMOKE=YES_I_ACCEPT_REAL_WRITES \
PRODUCTION_BASE_URL=https://<production-host> \
npm run smoke:production
```

脚本请求超时为 15 秒，不跟随重定向，不输出响应正文。默认流程不调用付费 Provider。

### 5.1 真实 Provider 冒烟

日常 `npm run test:managed` 固定使用 fixtures，保持零 Provider 网络请求。真实 Provider 冒烟使用独立 Node 测试配置，不会被默认 `test:unit` 或 CI 收集；只有取得当次付费调用授权后，才在本地终端显式执行：

```bash
RESEARCH_PROVIDER_MODE=live \
ALLOW_PAID_PROVIDER_SMOKE=I_CONFIRM_PAID_PROVIDER_CALLS \
PAID_PROVIDER_SMOKE_COST_LIMIT_USD=0.10 \
npm run test:providers:live
```

该命令从被 Git 忽略的 `.env.local` 读取 `TAVILY_API_KEY`、`DEEPSEEK_API_KEY`、`BAILIAN_API_KEY` 和 `BAILIAN_WORKSPACE_ID`，依次执行一次最小 Tavily Search、一次 DeepSeek `plan` 结构化调用和一次 1536 维百炼 Embedding。低于 `0.01 USD` 的成本上限会在创建 Provider 和发送请求前被拒绝；每次调用完成后立即记录实际估算费用，累计超限时不再调用下一家 Provider。三个适配器各使用 30 秒请求超时，测试只验证返回契约和非敏感费用总额，不输出 Key、请求 payload、搜索正文或模型正文；估算总成本超过显式 `0.10 USD` 上限时测试失败。

## 6. 发布与回滚

1. 小型维护验证后可以直接推送 `main`；该操作只更新集成分支，不触发 Vercel。
2. 准备发版时确认 `main` 的完整门禁通过，再把 `main` 快进或合并到 `release`；推送 `release` 后由 Vercel 自动部署 Production。
3. 有数据库迁移时先通过托管开发数据库 pgTAP/lint 和 CI migration 重建；只有 R1 获得明确授权后才前向应用到 Production。
4. 部署完成后运行一次默认生产冒烟。没有真实故障时不做例行回滚演练。
5. 真实发布故障时，把上一个已验证 Deployment 提升为 Production，并重新运行默认冒烟。

## 7. 备份与恢复

- Git 中的迁移文件是 Schema 恢复基线；涉及生产数据风险的变更前再按需导出数据。
- 数据导出只能保存在 Git 忽略的受控位置，不放入仓库、PR 附件或测试报告。
- 个人项目不安排例行恢复演练；未取得单独授权，不删除、覆盖或恢复 Production 数据。

## 8. 密钥轮换

- 密钥轮换不是例行任务，只在凭据泄漏、失效或服务明确要求时执行。
- 轮换时先写入新 Production 密钥并重新部署，生产冒烟通过后再撤销旧值。
- 任何疑似泄漏仍需检查 Git 历史、CI 日志和部署日志，不能只删除当前文件。
