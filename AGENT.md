# Evidence Graph Agent 工作流

## 产品边界

Evidence Graph 是一个可追溯的 AI 研究工作台，也是 Ailian 作品集中的主项目。MVP 把研究问题转换为持久化的来源、主张、证据关系、冲突和带引文的公开报告。

作品集只包含两个真实项目：

- Evidence Graph：本仓库开发的主项目。
- AI Photo Studio CN：已有的公开工程案例。

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
10. 创建或更新 Draft PR 后必须触发独立 Claude 审核。所有调用都必须带 `--setting-sources project,local`，防止用户级同名 skill 覆盖仓库 reviewer。普通 PR 在当前 PR 分支工作区根目录运行 `claude --setting-sources project,local --permission-mode auto --model sonnet -p "/pr-review"`；任何触及审核协议的 PR 必须从准确 `baseRefOid` detached worktree 运行 `/pr-review --trusted-base <PR编号>`。完整编排见 `~/.codex/skills/pr-review/SKILL.md` 和 `docs/bugbot-autofix-workflow.md` 第 7 节。
11. 审核进程可交给一个只读监控子代理，主进程继续不冲突任务；没有子代理时以前台方式运行。合并前必须取得当前 head SHA 的审核终态。
12. Cursor Bugbot 可用时只是附加审核。额度耗尽或服务不可用时不等待、不重复触发；Claude 审核始终是有效门禁。
13. Bugbot Autofix 活跃时由它先处理自己的问题；Autofix 失败、终止或不可用后，Codex 验证问题并接管。不得并发修复同一个问题。
14. 所有 Cursor Autofix 或 Codex 代码修复都必须检查差异、跑聚焦测试和完整模块门禁。修复留在原模块分支，不新开 PR；任何推送改变 head SHA 后必须重新运行第 10 步。Codex 判定 finding 无效且无需改代码时，发布带证据的结构化回复并触发同 SHA `--recheck`，不得手工改 Claude 标签。
15. CI 通过、存在 `claude-reviewed` 标签、最新 `CLAUDE_REVIEWED_SHA` 等于当前 head、没有 `claude-changes-requested` 且没有未解决的有效阻塞问题后，Codex 无需人工批准即可执行 `gh pr merge <PR编号> --merge --delete-branch`。PR #6 是用户批准的唯一一次流程引导；它合并后，协议 PR 不再有人工审核例外，必须使用可信基线模式。

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
