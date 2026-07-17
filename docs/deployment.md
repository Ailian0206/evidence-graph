# Evidence Graph 托管部署手册

本文档用于 Vercel、Supabase、Inngest 和 Sentry 的 Preview、Production 部署，以及上线后的回滚、备份和密钥轮换。所有资源创建、账号连接、远端迁移和真实请求都必须先通过 `AGENT.md` 的授权门禁。

## 1. 部署边界

- 日常测试只使用 fixture providers，不调用 OpenAI 或 Tavily。
- 不把 `.env.local`、Service Role、Signing Key、Sentry Auth Token、Provider 响应或包含私人来源正文的报告提交到 Git。
- Preview 与 Production 使用不同的 Supabase、Inngest 环境和密钥；不允许 Preview 写入 Production 数据库。
- 默认生产冒烟不创建项目、不运行研究、不调用付费 Provider。
- 真实 Provider 冒烟必须额外设置 `ALLOW_PAID_PROVIDER_SMOKE=YES_I_ACCEPT_PROVIDER_COST`，单次总成本上限为 1 美元；当前里程碑未获得授权时不得执行。

## 2. 本地门禁

使用 Node.js 22，在推送托管部署分支前运行：

```bash
nvm use
npm ci
npm run check:provider-boundary
npm run test:db
npm run test:ci
```

`test:db` 只连接本地 Supabase。CI 使用独立 database job 启动本地 Postgres，并在成功或失败后删除本地测试数据卷。

## 3. 资源创建顺序

### 3.0 当前资源状态

| 服务 | 环境或标识 | 状态 |
| --- | --- | --- |
| Supabase | Preview `vooexhwkqzymltwewcqc`，东京 | 迁移、33 个 pgTAP、Schema lint 和 GitHub Provider 已通过 |
| Supabase | Production `dibngceljmdkcgrzxubx`，东京 | 迁移、33 个 pgTAP、Schema lint 和 GitHub Provider 已通过 |
| GitHub OAuth | Preview App `3734029`，Production App `3734035` | 两套 Client Secret 已写入本地忽略文件，Preview 已完成一次轮换 |
| Inngest | Production，Preview `preview-e7881f94` | 两套 Event Key 和 Signing Key 已配置；等待部署 URL 后同步应用 |
| Sentry | EU 组织 `ailian0206`，项目 `evidence-graph` | DSN 已配置；Source Map Token 保持可选未配置 |
| Vercel | 默认域名 | 分支已推送；账号仍要求完成恢复审核，尚未创建项目 |

上述表格只记录非敏感标识。Client Secret、Service Role、Event Key、Signing Key 和 DSN 的值不得写入文档或 Git。

### 3.1 Supabase

1. 分别创建 Preview 和 Production 项目，保持 Postgres 主版本与 `supabase/config.toml` 一致。
2. 在本地通过官方 CLI 登录并链接 Preview 项目；项目引用只保存在 CLI 本地状态中。
3. 先检查再应用迁移：

```bash
npx supabase link --project-ref <preview-project-ref>
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

4. 在 Preview 重新验证跨租户 RLS、级联删除、精确引用和公开报告只读函数，再对 Production 重复迁移步骤。
5. 从项目设置取得 URL、Publishable Key 和 Service Role。Service Role 只能配置在 Vercel 服务端环境变量中。

### 3.2 GitHub OAuth

1. 创建 GitHub OAuth App。Authorization callback URL 使用 Supabase 提供的 `https://<project-ref>.supabase.co/auth/v1/callback`。
2. 在 Supabase Auth Providers 中启用 GitHub，并写入 OAuth Client ID 与 Client Secret。
3. Supabase Site URL 设置为当前环境的站点 URL。
4. Redirect URL allow list 精确加入 Preview 和 Production 的 `/auth/callback` 地址。Preview 使用稳定分支别名，不使用每次提交变化的临时 URL。
5. 验证登录回调只返回 `/<locale>/app` 及其子路径，不能跳转到站外地址。

### 3.3 Inngest

1. 为 Preview 和 Production 创建独立环境。
2. 将同步地址配置为对应站点的 `https://<host>/api/inngest`。
3. 分别取得 Event Key 与 Signing Key，并写入同一环境的 Vercel 变量。
4. 同步后确认函数 `run-managed-research` 的 owner 并发为 1、重试次数为 3、幂等键为 `runId`。
5. 当前执行器仍使用确定性 fixtures；在真实 Provider 适配器完成独立成本门禁前，不发送真实研究事件。

### 3.4 Sentry

1. 创建 Next.js 项目并取得 DSN，分别配置到 Preview 和 Production。
2. 需要 Source Map 时创建最小权限 Auth Token，并同时配置组织名和项目名；缺少完整三项时构建会自动跳过上传。
3. 不启用 Session Replay、用户输入录制或研究正文附件。
4. 首次验证只发送受控异常，确认 email、GitHub 用户名、研究问题、来源正文、quote 和 Provider payload 已被脱敏。

### 3.5 Vercel

1. 从 GitHub 导入仓库，使用 Node.js 22、`npm ci` 和 `npm run build`。
2. 先部署 Preview。Preview 验证通过后再提升或部署 Production。
3. 不在构建日志、部署说明或 PR 中粘贴密钥值。

## 4. 环境变量作用域

| 变量                                   | Preview    | Production       | 客户端可见 | 说明                   |
| -------------------------------------- | ---------- | ---------------- | ---------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | 独立值     | 独立值           | 是         | Supabase 项目 URL      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 独立值     | 独立值           | 是         | 公开 Publishable Key   |
| `SUPABASE_SERVICE_ROLE_KEY`            | 独立值     | 独立值           | 否         | 仅用于服务端所有权复核 |
| `INNGEST_EVENT_KEY`                    | 独立值     | 独立值           | 否         | Inngest 事件发送       |
| `INNGEST_SIGNING_KEY`                  | 独立值     | 独立值           | 否         | Inngest webhook 验签   |
| `NEXT_PUBLIC_SENTRY_DSN`               | 独立值     | 独立值           | 是         | Sentry 运行时上报      |
| `SENTRY_AUTH_TOKEN`                    | 可选       | 可选             | 否         | 构建期 Source Map 上传 |
| `SENTRY_ORG`                           | 可选       | 可选             | 否         | Sentry 组织名          |
| `SENTRY_PROJECT`                       | 可选       | 可选             | 否         | Sentry 项目名          |
| `PRODUCTION_BASE_URL`                  | 不配置     | 冒烟终端临时设置 | 否         | 生产站点 HTTPS Origin  |
| `ALLOW_PRODUCTION_SMOKE`               | 不配置     | 冒烟终端临时设置 | 否         | 防止误触发生产请求     |
| `OPENAI_API_KEY` / `TAVILY_API_KEY`    | 默认不配置 | 默认不配置       | 否         | 付费 Provider 专用门禁 |

Vercel 变量配置完成后，通过官方 CLI 拉取当前环境到已被 Git 忽略的 `.env.local`，再在不打印变量值的前提下检查：

```bash
npx vercel env pull .env.local --environment=preview
npm run verify:managed-env
```

检查 Production 时把 `--environment` 改为 `production`；检查结束后删除本地 `.env.local`，不要上传或提交。

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

脚本请求超时为 15 秒，不跟随重定向，不输出响应正文。默认流程明确输出“付费 Provider：未执行（成本上限 1 美元）”。

## 6. 发布与回滚

1. 记录通过门禁的 commit SHA、Vercel Deployment URL 和迁移版本。
2. 先验证 Preview，再部署 Production；上线后立即运行默认生产冒烟。
3. 应用迁移后只发布与新旧 Schema 都兼容的代码。破坏性列删除必须拆到后续里程碑。
4. 应用回滚优先在 Vercel 将上一个已验证 Deployment 提升为 Production，然后重新运行默认冒烟。
5. 数据库迁移不做盲目逆向回滚。若新代码需要关闭，先回滚应用；修复迁移通过 Preview 演练后再前向应用。
6. Inngest 异常时先暂停事件发送或禁用对应环境的函数同步，保留已有 run 与审计记录。

## 7. 备份与恢复演练

- Git 中的迁移文件是 Schema 恢复基线；每次上线前确认远端迁移历史与当前 commit 一致。
- 数据导出只保存到受控、加密且不受 Git 跟踪的位置，不得放入仓库、PR 附件或测试报告。
- 使用 Supabase 当前套餐提供的官方备份能力；不要假设免费层具有某个固定保留周期。
- 恢复演练只在 Preview 或独立演练项目执行：恢复备份后运行 33 个 pgTAP、跨租户 RLS 检查和默认应用冒烟。
- 未取得单独授权，不删除或覆盖 Production 数据，也不在 Production 验证恢复命令。

## 8. 密钥轮换

1. 先创建新密钥并写入 Preview，重新部署并验证。
2. 再写入 Production 并部署，确认新密钥生效后撤销旧密钥。
3. Inngest 使用 fallback signing key 完成无中断轮换；确认所有 Deployment 更新后再移除旧 key。
4. Supabase Service Role 泄漏时立即轮换，并重新部署所有持有该变量的环境。
5. Sentry Auth Token 只在构建期使用；轮换后检查旧 token 已撤销。
6. 任何疑似泄漏都要检查 Git 历史、CI 日志、Vercel 日志和终端记录；不能只删除当前文件。
