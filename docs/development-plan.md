# Evidence Graph 开发计划

## 交付策略

开发按模块分支和 Draft PR 拆分，使 CI 和自动审核器只检查已经形成完整里程碑的改动。每个模块必须可在本地运行、可独立测试，并且只有达到本地完成门禁后才创建一个 PR。

| 顺序 | 分支 | 范围 | 本地完成门禁 |
| ---: | --- | --- | --- |
| 1 | `feat/foundation-portfolio` | Next.js、双语作品集、设计系统、测试和 CI | 已完成；PR [#1](https://github.com/Ailian0206/evidence-graph/pull/1) 已合并 |
| 2 | `feat/research-domain` | 研究实体、fixtures、项目生命周期和持久化边界 | 已完成；PR [#3](https://github.com/Ailian0206/evidence-graph/pull/3) 已合并 |
| 3 | `feat/research-workflow` | 搜索/LLM Provider 接口、确定性工作流和精确引文 | 已完成；PR [#4](https://github.com/Ailian0206/evidence-graph/pull/4) 已合并 |
| 4 | `chore/pr-review-skill-setup` | 普通/可信基线 Claude 审核、自动修复、复审和自动合并 | PR [#6](https://github.com/Ailian0206/evidence-graph/pull/6) 的完整门禁和 CI 通过 |
| 5 | `fix/source-hash-project-scope-v2` | 来源内容哈希限制为项目内唯一 | RED-GREEN 证据、完整模块门禁和全自动 PR 审核通过 |
| 6 | `feat/evidence-workspace` | 主张列表、图谱、来源查看器、审核动作和响应式应用 | 桌面/移动端 E2E 和图谱交互测试通过 |
| 7 | `feat/managed-deployment` | Supabase Auth/RLS/pgvector、Inngest、Sentry 和 Vercel | 本地门禁加上授权后的生产冒烟测试 |

## 跨模块规则

- 每个模块开始前在 `docs/superpowers/plans/` 编写中文实施计划。
- 每个行为变更都执行 RED-GREEN-REFACTOR。
- Provider 测试默认使用 fixtures；只有带确认令牌的专用冒烟命令可以调用真实服务。
- 每个模块使用小粒度中文 Conventional Commits，并且只创建一个 Draft PR；中间提交不单独开 PR。
- 分支、PR、CI 或里程碑状态变化时更新 `PROJECT_STATUS.md`。
- 模块只有在 lint、typecheck、unit、build 和相关 Playwright 测试通过后才算完成。
- `docs/bugbot-autofix-workflow.md` 定义自动审核流程。Bugbot 不可用时不阻塞本地开发，由独立 Claude 审核承担必需门禁。
- 远端检查或审核运行时，主进程在独立分支/worktree 继续下一个不冲突任务；只读监控子代理负责报告终态。
- Claude 审核和 CI 通过后由 Codex 自动 merge commit，不包含人工审核步骤。

## 当前模块

完成 PR [#6](https://github.com/Ailian0206/evidence-graph/pull/6) 的全自动审核门禁并合并；随后立即进入 `fix/source-hash-project-scope-v2`，按 TDD 修复跨项目来源哈希冲突。
