# Evidence Graph Agent 工作流

## 产品边界

Evidence Graph 是一个可追溯的 AI 研究工作台，也是 Ailian 作品集中的主项目。MVP 把研究问题转换为持久化的来源、主张、证据关系、冲突和带引文的公开报告。

作品集包含三个真实项目：

- Evidence Graph：本仓库开发的主项目。
- AI Photo Studio CN：多模态写真 SaaS 工程案例。
- MCP Guardian：MCP 工具调用前的策略与审批网关（MVP 已本地可演示）。

MVP 不增加 ProjectPilot AI、通用聊天、计费、团队、浏览器扩展、OCR 导入或自托管模型。

## 工程优先级

1. 证据正确性和来源可追溯性。
2. 用户与项目数据隔离。
3. 成本有界和后台任务幂等。
4. 移动端与桌面端都保持安静、实用的界面质量。
5. 本地和 CI 验证可复现。

## 开发流程

1. 开始前检查 `git status -sb` 和当前实施计划。
2. 读取 `docs/roadmap.md` 与 `PROJECT_STATUS.md`；同一时间只允许一个有限里程碑处于进行中。
3. 先判断改动级别：小型维护可直接在已同步且干净的 `main` 上完成；里程碑改动使用模块分支，并优先用 `.worktrees/` 隔离工作区。
4. 每个里程碑开始前单独编写设计说明和实施计划，写清进入条件、用户可见结果、自动化门禁、本地验收、明确不做和终止条件。
5. 每个行为先写一个失败测试，并实际运行以确认预期失败。
6. 只实现让测试通过的最小改动。
7. 先跑聚焦验证，再在测试保持通过时重构。
8. 每次提交前运行 `git diff --check`、检查完整差异，并且只暂存本次改动文件。
9. 使用中文 Conventional Commits。
10. 小型 bug、局部样式或交互、文案、测试和少量文档维护，在完成相应聚焦验证后直接提交并 push `main`，不创建 PR；不得用小型维护绕过里程碑门禁。
11. 涉及数据库 Schema/迁移、鉴权或 RLS、Provider/部署边界、跨模块契约、新的完整用户流程、依赖升级或大范围重构时，视为里程碑改动；使用模块分支，并且在收口阶段只创建一个 Draft PR。
12. 自动化门禁通过后，把整个里程碑保持在一个分支并创建或更新唯一 Draft PR，再启动完整本地服务并给出 URL 与验收清单。用户明确本地验收通过前，不合并里程碑 PR，不更新为“已完成”，不开始下一里程碑。
13. 用户本地验收通过后，在现有 Draft PR 上运行独立 Claude Code：`claude --permission-mode auto --model sonnet -p "/codex-independent-pr-review <PR编号>"`。Claude 只审核和评论，不修改代码、不提交、不推送、不合并。
14. Claude 发现问题时，Codex 验证评论，在原分支按 TDD 修复，跑聚焦测试和完整门禁，直接提交并 push，然后重新运行第 13 步；不创建新 PR。
15. Claude 对当前 head SHA 返回 `pass` 且 GitHub CI 通过后，Codex 直接执行 `gh pr merge <PR编号> --merge --delete-branch`；审核修复改变用户可见行为时，合并前必须重新完成对应本地验收。
16. Cursor Bugbot 可用时只做附加审核。Autofix 活跃时由它先处理自己的 finding，Codex 不抢修同一个问题；Bugbot 不可用时不等待。
17. 当前里程碑 PR 由同一进程完成审核、修复、CI 和合并；里程碑收口后停止，不静默扩展或开始下一阶段。

## 里程碑状态沟通

涉及计划或里程碑执行时，状态说明必须优先回答：

- 当前阶段是什么。
- 本阶段用户最终能看到什么。
- 本阶段明确不做什么。
- 进入下一阶段还缺什么条件。

代码完成度、本地验收度、产品完成度和 Production 部署状态必须分开描述，不得用 PR 合并或 Production 可用替代产品完成。

## 成本与外部写入门禁

日常开发使用确定性 Provider fixtures。即使技术上可以直接执行，下列操作仍必须取得用户明确授权：

- 添加真实 Provider 密钥。
- 运行付费 Provider 冒烟测试。
- 购买或变更域名。
- 创建付费 Vercel、Supabase、Inngest 或 Sentry 资源。
- 发布 `docs/product-plan.md` 未列出的私人身份信息或仓库数据。

用户已经授权本项目直接推送已验证的小型 `main` 提交，以及创建 GitHub 仓库、模块分支、Draft PR 和执行常规 PR 维护，不需要逐项确认。

Production 当前冻结。C6 本地 Release Candidate 通过前，不更新 `release`，不执行 Production 数据库迁移、环境变量修改、Inngest 同步或重新部署；C6 通过后仍需取得用户明确发布授权。

## 验证门禁

仓库基础模块完成后必须提供以下命令：

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
npm run test:ci
```

界面改动必须包含 390x844、1024x768 和 1440x1000 三种尺寸的 Playwright 截图验证，并确认没有横向溢出、文字裁切、异常重叠、主要视觉空白或由图谱标签和控件引起的布局偏移。
