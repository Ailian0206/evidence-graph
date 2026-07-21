# Evidence Graph 当前会话交接

> 交接时间：2026-07-20
> 仓库：`/Users/ailian/Desktop/2026simply/ai-practice/evidence-graph`
> 最新综合工作区：`.worktrees/report-publishing`

## 1. 新任务启动顺序

新任务不要直接沿用本文中的外部状态。先执行以下检查，再继续开发：

```bash
cd /Users/ailian/Desktop/2026simply/ai-practice/evidence-graph
export PATH=/Users/ailian/.nvm/versions/node/v22.22.1/bin:$PATH

cat AGENT.md
git status -sb
git worktree list
gh pr list --state open
```

然后读取：

1. `.worktrees/report-publishing/PROJECT_STATUS.md`
2. `.worktrees/report-publishing/docs/development-plan.md`
3. 当前准备处理的模块计划
4. 本交接文档

## 2. Git 与 worktree 状态

交接时所有下列工作区均为干净状态：

| 工作区 | 分支 | Head | 状态 |
| --- | --- | --- | --- |
| 仓库根目录 | `main` | `833fa47` | 与 `origin/main` 一致，最后记录 PR #11 合并 |
| `.worktrees/managed-deployment` | `feat/managed-deployment` | `3b5dc70` | 已推送，领先 `main` 13 个提交 |
| `.worktrees/durable-research-results` | `feat/durable-research-results` | `8a0e8e0` | 仅本地，基于 `3b5dc70`，新增 9 个提交 |
| `.worktrees/report-publishing` | `feat/report-publishing` | `e2d78e7` | 仅本地，基于 `8a0e8e0`，新增 9 个提交 |

`foundation-portfolio`、`research-domain` 和 `research-workflow` 的旧 worktree 仍存在。它们不是当前开发入口，不要在未核对分支和用户改动前清理。

## 3. 当前 GitHub 状态

### PR #12

- 地址：`https://github.com/Ailian0206/evidence-graph/pull/12`
- 标题：`docs(portfolio): MCP Guardian 一键安装叙事`
- 分支：`chore/mcp-guardian-install-copy -> main`
- 状态：Open、非 Draft、GitHub 显示可合并。
- CI：`lint / typecheck / unit / build / e2e` 已于 2026-07-16 成功。
- 独立 Claude 审核：尚未执行，GitHub 没有 review 或审核评论。

新任务的第一项工作是按仓库流程闭环 PR #12：

```bash
claude --permission-mode auto --model sonnet -p "/codex-independent-pr-review 12"
```

读取 `CLAUDE_REVIEW_RESULT` 和 `CLAUDE_REVIEWED_SHA`。如果结果为 `changes_requested`，先验证问题，再在原分支按 TDD 修复、运行完整门禁、提交并 push，然后重新审核。如果当前 head 为 `pass` 且 CI 成功，使用 merge commit 合并；禁止 squash、rebase 和 force push。

## 4. 已完成模块

### 证据工作台

- PR #11 已通过独立 Claude 审核和 CI。
- merge commit：`74c3b49`。
- `main` 上的状态文档提交：`833fa47`。

### 托管部署本地部分

- 分支：`feat/managed-deployment`。
- Supabase Preview 和 Production、GitHub OAuth、Inngest 环境、Sentry 项目与本地密钥边界已经配置。
- Preview 备份恢复演练已经完成。
- `npm run test:managed` 已通过 33 个数据库测试、118 个单元测试、生产构建和 36 个 E2E。
- `.worktrees/managed-deployment/.env.local` 存在、权限为 `0600`、被 Git 忽略。不得输出、复制或提交其中的值。
- 尚缺 Vercel 部署 URL、Inngest 应用同步、生产冒烟和 Vercel 回滚验证。

### 持久化研究结果

- 分支：`feat/durable-research-results`，仅本地，尚未 push 或创建 PR。
- 已完成原子研究创建、Inngest 快照持久化、真实工作台读取、失败重投和 Claim 审核写回。
- `npm run test:managed` 已通过 51 个数据库测试、142 个单元测试、生产构建和 36 个 E2E。

### 报告发布

- 分支：`feat/report-publishing`，仅本地，尚未 push 或创建 PR。
- 已完成原子发布与撤销、稳定 slug、版本切换、工作台报告模式和 `/r/[slug]` 匿名只读报告。
- `npm run test:managed` 已通过 86 个数据库测试、167 个单元测试、生产构建和 45 个 E2E。
- 390x844、1024x768、1440x1000 三档视觉验证通过。

## 5. 外部服务状态

项目文档最后确认 Vercel 状态的时间是 2026-07-17：账号恢复申请已提交，官方邮件给出的典型审核时间为 1 个工作日。该状态可能已经变化，新任务在处理托管部署前必须通过用户邮件或 Vercel 页面重新核验，不得把旧记录当作当前结果。

已配置但仍需在部署 URL 可用后收口的资源：

- Supabase：东京区 Preview 与 Production。
- GitHub OAuth：Preview 与 Production 两套 App。
- Inngest：Production 与 Preview 环境，等待应用同步。
- Sentry EU：`ailian0206/evidence-graph`。

创建付费资源、购买域名、写入新密钥或运行付费 Provider 请求前仍需明确授权。

## 6. Provider 决策

- 日常开发和 CI 必须使用确定性 fixtures，默认禁止真实 Provider 调用。
- Embedding 已决定使用阿里云百炼 `text-embedding-v4`，固定输出 1536 维。
- 百炼账号与密钥等待用户后续提供，当前不得接入或调用。
- 用户有公司 OpenAI-compatible 通道可用于语言模型，但接入前仍需验证接口契约；不要假定它支持 Embedding。
- 真实 OpenAI、Tavily 或其他付费冒烟必须使用专用确认门禁和成本上限。

## 7. 后续开发顺序

严格按以下顺序推进，不创建堆叠 PR：

1. 完成 PR #12 的独立 Claude 审核、必要修复、CI 和 merge commit 闭环。
2. 重新核验 Vercel 账号状态；账号可用后完成 Preview、Production、Supabase Redirect、Inngest 同步、非付费生产冒烟和回滚演练。
3. 为 `feat/managed-deployment` 创建唯一 Draft PR 并完整闭环。
4. 托管部署合并后，对齐 `feat/durable-research-results`，重新运行门禁，只创建一个 Draft PR 并完整闭环。
5. 持久化研究结果合并后，对齐 `feat/report-publishing`，重新运行门禁，只创建一个 Draft PR 并完整闭环。
6. 报告发布合并后，从最新 `main` 创建 `feat/ui-experience-refresh`，集中完成全局 UI 体验优化。
7. 用户提供 Provider 条件后，接入真实搜索、语言模型和百炼 Embedding，完成一次真实研究与公开报告的 MVP 上线门禁。

## 8. 全局 UI 优化要求

UI 优化必须作为独立里程碑，不混入现有功能分支。开始前调用前端界面相关技能，对作品集、登录页、项目页、研究工作台和公开报告做统一审计与设计。

重点问题：

- 当前存在大量 `10-12px` 小字号，需要提高正文、辅助信息和控件的可读性。
- 多个页面存在 `72-112px` 的大段纵向留白，需要建立更紧凑、稳定的节奏。
- 打开页面后主任务和关键信息不够突出，需要重新梳理首屏层级。
- 去除左侧装饰边线，不再使用此类引用、状态或分区样式。
- 减少小号大写 eyebrow、重复卡片、胶囊标签和模板化文案等明显 AI 风格。
- 工作台保持安静、实用、可扫描，不改坏现有图谱、报告和来源联动。

验收必须覆盖 390x844、1024x768、1440x1000 三档截图、键盘访问、横向溢出、文字裁切、控件重叠和完整模块门禁。整个 UI 里程碑只创建一个 Draft PR。

## 9. PR 自动审核流程

1. 模块功能和完整门禁均完成后，才创建一个 Draft PR。
2. 运行独立 Claude Code 审核。Claude 只审核和评论，不修改代码、不提交、不 push、不合并。
3. 有问题时由 Codex 在原分支验证并修复，直接提交和 push，然后重新审核；不创建新 PR。
4. Claude 对当前 head SHA 返回 `pass` 且 GitHub CI 成功后，Codex 自动使用 merge commit 合并，无人工审核步骤。
5. Cursor Bugbot 本月额度已耗尽，不等待。以后 Bugbot Autofix 恢复时，不与它抢修同一个 finding。
6. 当前 PR 完整闭环前不开始下一个模块，不使用子代理监听。

## 10. 不可违反的约束

- 行为变更执行 RED-GREEN-REFACTOR。
- 使用 Node.js `v22.22.1`。
- 文档和用户沟通使用中文；代码注释使用英文；界面支持中文和英文。
- 使用中文 Conventional Commits，一次提交只包含一个逻辑改动。
- 不提交密钥、`.env`、私人来源正文或付费 Provider 响应。
- 不执行 squash、rebase、force push 或历史改写。
- 不频繁创建 PR，一个完整模块只创建一个 PR。
- 不因等待外部审核而盲目轮询；状态没有变化时明确说明外部阻塞。
