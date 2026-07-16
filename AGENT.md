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
2. 在模块分支开发；基线仓库建立后优先使用 `.worktrees/` 隔离工作区。
3. 每个行为先写一个失败测试，并实际运行以确认预期失败。
4. 只实现让测试通过的最小改动。
5. 先跑聚焦验证，再在测试保持通过时重构。
6. 每次提交前运行 `git diff --check`、检查完整差异，并且只暂存当前模块文件。
7. 使用中文 Conventional Commits。
8. PR 保持模块粒度；中间任务、单纯审核清理或每个小提交都不单独开 PR。
9. 模块达到里程碑后先跑完整门禁，再推送分支并只创建一个 Draft PR。
10. 创建或更新 Draft PR 后，运行独立 Claude Code：`claude --permission-mode auto --model sonnet -p "/codex-independent-pr-review <PR编号>"`。Claude 只审核和评论，不修改代码、不提交、不推送、不合并。
11. Claude 发现问题时，Codex 验证评论，在原分支按 TDD 修复，跑聚焦测试和完整门禁，直接提交并 push，然后重新运行第 10 步；不创建新 PR。
12. Claude 对当前 head SHA 返回 `pass` 且 GitHub CI 通过后，Codex 无需人工批准，直接执行 `gh pr merge <PR编号> --merge --delete-branch`。
13. Cursor Bugbot 可用时只做附加审核。Autofix 活跃时由它先处理自己的 finding，Codex 不抢修同一个问题；Bugbot 不可用时不等待。
14. 审核和 CI 等待可交给一个只读子代理，主进程继续其它不冲突任务。

## 成本与外部写入门禁

日常开发使用确定性 Provider fixtures。即使技术上可以直接执行，下列操作仍必须取得用户明确授权：

- 添加真实 OpenAI 或 Tavily 密钥。
- 运行付费 Provider 冒烟测试。
- 购买或变更域名。
- 创建付费 Vercel、Supabase、Inngest 或 Sentry 资源。
- 发布 `docs/product-plan.md` 未列出的私人身份信息或仓库数据。

用户已经授权本项目创建 GitHub 仓库、模块分支、推送、Draft PR 和执行常规 PR 维护，不需要逐项确认。

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
