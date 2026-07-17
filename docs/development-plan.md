# Evidence Graph 开发计划

## 交付策略

开发按模块分支和 Draft PR 拆分，使 CI 和自动审核器只检查已经形成完整里程碑的改动。每个模块必须可在本地运行、可独立测试，并且只有达到本地完成门禁后才创建一个 PR。

| 顺序 | 分支 | 范围 | 本地完成门禁 |
| ---: | --- | --- | --- |
| 1 | `feat/foundation-portfolio` | Next.js、双语作品集、设计系统、测试和 CI | 已完成；PR [#1](https://github.com/Ailian0206/evidence-graph/pull/1) 已合并 |
| 2 | `feat/research-domain` | 研究实体、fixtures、项目生命周期和持久化边界 | 已完成；PR [#3](https://github.com/Ailian0206/evidence-graph/pull/3) 已合并 |
| 3 | `feat/research-workflow` | 搜索/LLM Provider 接口、确定性工作流和精确引文 | 已完成；PR [#4](https://github.com/Ailian0206/evidence-graph/pull/4) 已合并 |
| 4 | `chore/pr-review-skill-setup` | 独立 Claude Code PR 审核流程 | PR [#6](https://github.com/Ailian0206/evidence-graph/pull/6) 和 [#8](https://github.com/Ailian0206/evidence-graph/pull/8) 已合并；当前补充串行闭环约束 |
| 5 | `fix/source-hash-project-scope-v2` | 来源内容哈希限制为项目内唯一 | PR [#7](https://github.com/Ailian0206/evidence-graph/pull/7) 已通过完整门禁和独立审核后合并 |
| 6 | `feat/evidence-workspace` | 主张列表、图谱、来源查看器、审核动作和响应式应用 | 已完成；PR [#11](https://github.com/Ailian0206/evidence-graph/pull/11) 已通过独立审核和 CI 后合并 |
| 7 | `feat/managed-deployment` | Supabase Auth/RLS/pgvector、Inngest、Sentry 和 Vercel | 本地门禁已完成；等待 Vercel 账号恢复后执行生产冒烟与回滚演练 |
| 8 | `feat/durable-research-results` | 原子创建研究、Inngest 快照持久化、真实工作台和 Claim 审核 | 本地完成；`test:managed` 通过 51 个数据库测试、142 个单元测试和 36 个 E2E；等待父分支合并后再创建一个 Draft PR |
| 9 | `feat/report-publishing` | 报告发布、撤销、公开 slug、版本切换和分享页 | 本地完成；`test:managed` 通过 86 个数据库测试、167 个单元测试和 45 个 E2E；等待父分支合并后再创建一个 Draft PR |
| 10 | `feat/ui-experience-refresh` | 全站字体、间距、信息层级和视觉语言统一，移除左侧装饰边线与明显 AI 化样式 | 前置模块全部合并后启动；先用前端界面技能完成全站审计和设计规范，再通过三档截图对比、可访问性检查与完整门禁 |

## 跨模块规则

- 每个模块开始前在 `docs/superpowers/plans/` 编写中文实施计划。
- 每个行为变更都执行 RED-GREEN-REFACTOR。
- Provider 测试默认使用 fixtures；只有带确认令牌的专用冒烟命令可以调用真实服务。
- 每个模块使用小粒度中文 Conventional Commits，并且只创建一个 Draft PR；中间提交不单独开 PR。
- 分支、PR、CI 或里程碑状态变化时更新 `PROJECT_STATUS.md`。
- 模块只有在 lint、typecheck、unit、build 和相关 Playwright 测试通过后才算完成。
- `docs/bugbot-autofix-workflow.md` 定义自动审核流程。Bugbot 不可用时不阻塞本地开发，由独立 Claude 审核承担必需门禁。
- PR 创建后由当前进程依次完成 Claude 审核、问题修复、重新审核、CI 等待和合并；当前 PR 完整闭环前不开始下一个模块。
- Claude 审核和 CI 通过后由 Codex 自动 merge commit，不包含人工审核步骤。

## 当前模块

`feat/managed-deployment` 正等待 Vercel 账号恢复结果；`feat/durable-research-results` 和 `feat/report-publishing` 已分别在独立 worktree 完成本地门禁。三个里程碑必须依次完成 PR 闭环；报告发布分支在两个父分支合并前不得 push 或创建堆叠 PR。它们全部合并后再从最新 `main` 开始 `feat/ui-experience-refresh`，不把全局视觉改动分散混入现有功能分支。
