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

## 本地真实研究

使用 Node.js 22，并确保 Docker 可用：

```bash
nvm use
npm install
```

在 Git 忽略的 `.env.local` 中配置四项 Provider 凭据和本地 live 门禁：

```bash
TAVILY_API_KEY=
DEEPSEEK_API_KEY=
BAILIAN_API_KEY=
BAILIAN_WORKSPACE_ID=
RESEARCH_PROVIDER_MODE=live
ALLOW_LOCAL_LIVE_RESEARCH=I_CONFIRM_LOCAL_PAID_RESEARCH
LOCAL_LIVE_RESEARCH_COST_LIMIT_USD=0.15
```

一个命令会启动或复用本地 Supabase，并同时启动 Next.js 与 Inngest Dev Server：

```bash
npm run dev:local
```

- 登录入口：`http://127.0.0.1:3218/zh/auth/login`
- Inngest：`http://127.0.0.1:8288`
- 本地 Supabase Studio：以 `supabase status` 显示的地址为准

启动脚本会从本地 Supabase CLI 更新 `.env.local` 中的 URL 与 Key，保留 Provider 凭据，并把文件权限固定为 `0600`。单次完整研究的累计估算费用达到 `0.15 USD` 后，不再开始下一次 Provider 调用。

## 开发与测试命令

普通 `npm run dev` 只启动 Next.js，Provider 默认为 fixtures；它不提供完整的本地 Supabase、Inngest 和匿名登录编排。

```bash
npm run test:unit        # fixture 单元与组件回归
npm run test:e2e         # fixture build 与浏览器回归
npm run test:managed     # fixture 完整工程门禁
npm run test:providers:live  # 需要独立确认变量的最小真实 Provider 冒烟
```

即使 `.env.local` 配置为 live，`test:unit`、`test:e2e`、`test:ci` 和 `test:managed` 也会显式覆盖为 fixture。Playwright 默认使用 `3217` 端口；需要时可以通过 `PLAYWRIGHT_PORT` 覆盖。
