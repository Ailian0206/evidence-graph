# C1 托管开发数据库与本地研究闭环设计

修订日期：2026-07-24
状态：第三版，等待用户书面审阅

## 1. 背景与纠正

第一版 C1 把本地 Supabase、Inngest、Next.js、认证、真实 Provider 和最终验收放进一个启动入口。`supabase start` 因此启动了当前验收不需要的完整容器组；Inngest 仍使用 100 个队列 worker 的默认值。真实研究又沿用最多 12 个来源、20 万正文字符的产品上限，最终产生 57 个 embedding 批次和约 65 个持久化步骤。

这套方案在 16 GB 内存的开发机器上不可接受，也让基础设施进度替代了用户可见的产品进度。第一版中的本地 Supabase Docker 编排和远程 anonymous 登录方案停止执行。

## 2. 目标

C1 改为使用一个托管 Supabase 项目作为当前开发数据库。本地只运行需要被用户操作或调试的进程，并在一个里程碑内完成以下工作：

1. 本地登录并看到项目列表。
2. 完成一条确定性的 fixture 研究闭环。
3. 完成一条受资源和成本限制的中文真实研究。

以上只是 C1 内部的实现顺序，不拆成 C1-A/C1-B/C1-C，不设置中途用户验收，不拆分支或 PR。全部实现和自动化门禁完成后创建一个 Draft PR，再提供固定本地 URL 和完整验收清单供用户一次性测试；用户验收前不得合并。

## 3. 环境模型

### 3.1 当前托管 Supabase 是开发数据库

- 本地 Next.js 连接当前托管 Supabase，不再启动本地 Supabase Docker。
- 该项目在 C1-C6 期间按开发数据库管理，允许保存测试账号、fixture 数据和真实研究验收数据。
- 现有 Vercel/`release` 只保留历史基线，不代表当前数据库仍是干净的 Production 数据库。
- C6 以前继续冻结 `release`、Vercel Production 配置、Production Inngest 同步和正式部署。
- 当前历史部署仍可能访问同一数据库，因此 C1-C6 的迁移必须保持前向兼容，不执行破坏现有读取路径的删列、改类型或清表操作。

正式发布时再单独决策：优先根据完整 migration 链创建新的 Production Supabase；也可以在明确备份和清理清单后复用当前项目。该决策不属于 C1。

### 3.2 本地运行分为三个入口

| 入口 | 进程 | 用途 |
| --- | --- | --- |
| UI 开发 | Next.js | 公共页面、静态 demo、样式和普通交互 |
| 数据开发 | Next.js + 托管 Supabase | 登录、项目、设置和数据读写 |
| 研究验收 | Next.js + 单 worker Inngest + 托管 Supabase | fixture 或显式授权的真实研究 |

任何入口都不自动启动 Docker。研究验收结束后，Agent 必须停止本地 Inngest 和不再需要的 Next.js 进程。

### 3.3 认证使用现有 GitHub OAuth

托管 Supabase 不启用 anonymous sign-in。本地应用使用现有 GitHub OAuth，并在 Supabase Auth redirect allow list 中增加固定 loopback 回调。这样不会增加共享匿名账号，也不会让开发入口泄漏到现有部署。

本地 URL 固定为 `http://127.0.0.1:3218`。认证回调只允许仓库定义的相对目标路径，不接受任意外部跳转。

## 4. 安全边界

- `.env.local` 只保存本地运行所需变量，权限保持 `0600`，继续被 Git 忽略。
- 本地启动必须要求显式允许的 Supabase Project Ref；环境 URL 与允许值不一致时拒绝连接。
- 不在日志、测试、文档或回复中打印 Supabase、Provider、OAuth 或 Inngest 密钥。
- `db reset`、全量清理、批量删除 Auth 用户和破坏性 SQL 不进入普通开发命令，必须使用独立确认令牌。
- 所有 Schema 变化继续以不可变 migration 文件为事实来源；禁止只在 Supabase Dashboard 手工修改 Schema。
- Migration 先应用到当前开发数据库并通过数据库测试。C6 和新的发布授权以前不创建或迁移正式数据库。
- 自动化测试继续强制 fixture；`.env.local` 的存在不能让 Vitest、Playwright 或 CI 发起真实 Provider 请求。

## 5. 轻量 Inngest 与研究预算

本地研究验收只在需要执行后台工作流时启动 Inngest Dev Server，并使用低资源参数：

```text
--queue-workers 1
--tick 1000
--persist
--log-level warn
```

fixture 和 live 共用相同持久化工作流，差别只在 Provider runtime。真实研究还必须同时满足：

- 明确的本地付费确认令牌。
- 单次估算费用上限 `0.15 USD`。
- 最多 4 个来源。
- 最多 40,000 个来源正文字符。
- 最多 20 个 embedding 批次；达到限制时返回稳定错误，不继续外呼。

这些是 C1 本地验收预算，不改变未来正式产品的上限。每次 Provider 调用前检查剩余预算，调用后记录脱敏 usage；日常测试不得调用真实 Provider。

## 6. C1 内部实施顺序与单次验收

以下步骤属于同一个 C1，不形成子里程碑：

1. 改造本地环境入口，连接托管开发 Supabase，并使用 GitHub OAuth 验证登录和项目列表。
2. 启动单 worker Inngest，以 fixture Provider 从 UI 跑通完整持久化研究闭环，不产生 Provider 费用。
3. 在既定来源、正文、embedding 批次和费用上限内，从 UI 完成一条低范围中文真实研究。
4. 修复所有阻止 C1 完成的实现问题，运行聚焦测试和完整 `npm run test:managed`。
5. 将 C1 全部改动提交到同一分支，创建一个 Draft PR，不拆分多个 PR。
6. Agent 启动最终本地环境并提供固定 URL、内存情况和一份完整验收清单。
7. 用户一次性检查登录、项目列表、研究状态、真实来源、Claim、Evidence、运行日志和带引文报告。

用户验收前 Draft PR 不得合并。验收发现的 C1 阻塞问题继续在同一分支和同一 PR 修复并复验；通过后才进入独立审核、CI 和合并，不在同一周期开始 C2。

## 7. 数据与失败恢复

- 托管 Supabase 不可达：页面显示稳定错误；不切换到 Production 备用连接。
- OAuth 失败：返回登录页；不创建匿名账号或硬编码测试密码。
- Inngest 未运行：研究创建前明确阻止或把投递失败写成可重试状态，不能无限停留 queued。
- Provider 或预算失败：run 写入稳定 failed 状态，不自动重放付费步骤。
- 本地进程被停止时遗留 running run：下次启动先列出并由 Agent确认处理，不静默继续付费运行。
- fixture 和真实研究数据使用可识别的开发 owner/run 标记；正式发布前按独立清理计划处理。

## 8. 测试与验证

1. 单测覆盖托管开发环境校验、Supabase Project Ref allow list 和敏感值脱敏。
2. 单测覆盖本地 Inngest 参数、子进程退出清理和“不启动 Docker”合约。
3. Auth 测试覆盖 GitHub OAuth loopback redirect，不保留 remote anonymous 登录入口。
4. fixture 工作流测试覆盖完整持久化和 ready 重放，不调用真实 Provider。
5. live runtime 测试覆盖 4 个来源、40,000 字符、20 个 embedding 批次和 `0.15 USD` 上限。
6. 每个实现改动后运行最小相关门禁；创建唯一 Draft PR 前运行完整 `npm run test:managed`。
7. 界面改动按项目规则检查 390x844、1024x768 和 1440x1000，确认无溢出、裁切和重叠。

## 9. 当前分支处理

已有实现不整体丢弃，但必须按第三版设计逐项审查：

- 保留：fixture 测试隔离、本地 live 成本门禁、可复用的环境文件安全写入、Inngest replay 压缩修复。
- 改造：本地启动脚本移除 `supabase start`，改为校验并连接显式允许的托管开发项目。
- 移除或替换：remote Supabase anonymous 登录入口，改用现有 GitHub OAuth。
- 暂不处理：被中断的真实研究记录；只有在托管开发连接完成并明确恢复服务后才能核对和清理。

## 10. 明确不做

- 不启动本地 Supabase Docker。
- 不新增第二个开发数据库或第三套应用部署环境。
- 不更新 `release`，不修改 Vercel Production，不同步 Production Inngest。
- 不实现 Settings、账号删除、Evidence Eval 或 3 个真实案例。
- 不为了省事绕过 RLS、Auth、持久化工作流或 migration 纪律。
- 不把真实密钥、Provider payload、来源全文或付费原始响应写入 Git。

## 11. 完成标准

- 登录、项目列表、fixture 闭环和低范围真实研究作为一个完整 C1 交付，并通过用户一次性本地验收。
- Evidence Graph 本地运行期间没有项目 Docker 容器。
- 真实研究在来源、正文、embedding 批次和费用四类预算内完成或明确失败。
- 自动化门禁保持 fixture-only，完整模块门禁通过。
- C1 只有一个分支和一个 Draft PR；用户验收和独立审核完成后才合并，Production 继续冻结。
