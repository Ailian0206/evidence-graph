# Evidence Graph

Evidence Graph 是一个可追溯的 AI 研究工作台，也是 Ailian 的个人作品集。它把研究问题转换为持久化的来源、主张、证据关系、冲突和带引文报告，读者可以逐层检查到原始证据片段。

项目可在本地运行。产品操作可以使用真实 Provider；自动化回归固定使用确定性 fixtures，不调用付费 API。

## 项目文档

- `docs/roadmap.md`：当前真实进度、本地验收里程碑和 Production 发布顺序。
- `docs/product-plan.md`：产品、架构、部署、成本和交付决策。
- `docs/development-plan.md`：单个有限里程碑的开发、验收与 PR 执行流程。
- `docs/deployment.md`：托管部署、生产冒烟、回滚、备份和密钥轮换。
- `PROJECT_STATUS.md`：当前执行状态。
- `AGENT.md`：工程、GitHub、成本和验证流程。

## 本地开发

使用 Node.js 22：

```bash
nvm use
npm install
```

本地应用连接当前托管开发 Supabase，不启动本地数据库容器。在 Git 忽略的 `.env.local` 中配置托管数据库，并显式填写允许连接的 Project Ref：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF=
```

fixture profile 不调用真实 Provider，适合日常开发：

```bash
npm run dev:local
```

需要查看真实研究结果时，再配置四项 Provider 凭据和 live 门禁：

```bash
TAVILY_API_KEY=
DEEPSEEK_API_KEY=
BAILIAN_API_KEY=
BAILIAN_WORKSPACE_ID=
RESEARCH_PROVIDER_MODE=live
ALLOW_LOCAL_LIVE_RESEARCH=I_CONFIRM_LOCAL_PAID_RESEARCH
LOCAL_LIVE_RESEARCH_COST_LIMIT_USD=0.15
```

然后使用 live profile：

```bash
npm run dev:local:live
```

- 登录入口：`http://127.0.0.1:3218/zh/auth/login`
- Inngest：`http://127.0.0.1:8288`
- 登录方式：现有 GitHub OAuth，回调为 `http://127.0.0.1:3218/auth/callback`

两个 profile 都只启动 Next.js 和最小可调度的 5 worker Inngest。启动脚本校验托管 Project Ref，并把 `.env.local` 权限收紧为 `0600`，不会重写文件内容。live 单次研究最多使用 4 个来源、40,000 个正文字符、20 个 embedding 批次和 `0.15 USD`；达到上限后不再开始下一次对应 Provider 调用。

## 开发与测试命令

普通 `npm run dev` 只启动 Next.js。完整研究流程使用 `dev:local` 或 `dev:local:live`，两者都复用托管开发数据库和 GitHub OAuth。

```bash
npm run test:unit        # fixture 单元与组件回归
npm run test:e2e         # fixture build 与浏览器回归
npm run test:managed     # linked pgTAP + fixture 工程门禁，不启动本机 Docker
npm run test:providers:live  # 需要独立确认变量的最小真实 Provider 冒烟
```

`test:db:hosted` 在执行前核对 CLI link 与 `.env.local` allow-list，只运行事务内 pgTAP 和 lint，不执行远端 reset、迁移或 seed。`test:unit`、`test:e2e` 和 `test:ci` 不调用真实 Provider；`test:managed` 组合托管数据库门禁与这些 fixture 工程门禁。Playwright 默认使用 `3217` 端口；需要时可以通过 `PLAYWRIGHT_PORT` 覆盖。
