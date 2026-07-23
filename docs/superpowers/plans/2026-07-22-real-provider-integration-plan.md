# 真实 Provider 接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Production 研究直接使用 Tavily、DeepSeek 和百炼，同时保证开发、测试和 CI 默认零网络、零 Provider 费用。

**Architecture:** 服务端运行时工厂按环境选择 live 或 fixture Provider；Production 强制 live，非 Production 默认 fixture。Inngest 执行前从 Supabase 读取真实 Project/Run，随后复用现有 `runResearchWorkflow` 和 Durable Writer；三家适配器通过现有 Provider contracts 与工作流隔离。

**Plan correction (2026-07-23):** 实现中发现 Production 的 `source_chunks_embedding_model_check` 只允许 `text-embedding-3-small`，原设计“不新增数据库迁移”的前提不成立。经用户明确批准，增加一个保留历史元数据、默认新模型为 v4 的兼容前向迁移，不覆写历史行。

**Tech Stack:** Next.js 16、TypeScript、Zod 4、Inngest、Supabase、Vitest、原生 `fetch`

---

### Task 1: 固化真实运行输入

**Files:**
- Create: `src/features/research/supabase-workflow-reader.ts`
- Modify: `src/features/research/domain.ts`
- Modify: `src/features/research/fixtures.ts`
- Modify: `src/features/research/run-research-workflow.ts`
- Modify: `src/inngest/functions/run-research.ts`
- Test: `tests/unit/inngest-research.test.ts`
- Test: `tests/unit/research-workflow.test.ts`

- [x] **Step 1: 写 Reader 与 executor 的失败测试**

测试用伪 Supabase 查询返回真实中文问题、语言、run limits 和 `manual_urls`，断言 executor 的首个 model payload 使用真实问题而不是 demo 问题。

- [x] **Step 2: 运行测试并确认 RED**

Run: `npm run test:unit -- tests/unit/inngest-research.test.ts tests/unit/research-workflow.test.ts`

Expected: FAIL，缺少 Reader/executor 或 payload 未携带真实问题。

- [x] **Step 3: 实现最小 Reader 与真实快照**

Reader 同时限定 owner/project/run；Project domain 增加 `language: "zh" | "en"`。executor 使用 Reader 返回值创建空结果快照，不复制 demo Project。

- [x] **Step 4: 把 question/language 传入所有模型操作**

在 `plan`、`extract_claims`、`link_evidence`、`detect_conflicts`、`draft_report` payload 中加入稳定 research context。

- [x] **Step 5: 运行聚焦测试并确认 GREEN**

Run: `npm run test:unit -- tests/unit/inngest-research.test.ts tests/unit/research-workflow.test.ts`

Expected: PASS。

### Task 2: 扩展手动 URL 提取契约

**Files:**
- Modify: `src/providers/contracts.ts`
- Modify: `src/providers/fixtures/research-providers.ts`
- Modify: `src/features/research/run-research-workflow.ts`
- Test: `tests/unit/research-workflow.test.ts`

- [x] **Step 1: 写 manual URL Extract 失败测试**

断言最多 5 个 URL 在 collecting 步骤调用一次 `search.extract`，保存 usage，并把提取正文纳入来源；重试时复用保存结果。

- [x] **Step 2: 运行测试并确认 RED**

Run: `npm run test:unit -- tests/unit/research-workflow.test.ts`

Expected: FAIL，`SearchProvider` 尚无 `extract`。

- [x] **Step 3: 实现 `extract` 与 collecting 幂等逻辑**

为 `SearchProvider` 增加批量 Extract；fixture 返回确定性正文；工作流用 `${runId}:collecting:manual` 保存结果与 usage。

- [x] **Step 4: 运行聚焦测试并确认 GREEN**

Run: `npm run test:unit -- tests/unit/research-workflow.test.ts`

Expected: PASS。

### Task 3: 实现 Tavily 适配器

**Files:**
- Create: `src/providers/live/provider-http.ts`
- Create: `src/providers/live/tavily-provider.ts`
- Test: `tests/unit/live-providers.test.ts`

- [x] **Step 1: 写 Search/Extract mock-fetch 失败测试**

覆盖 Bearer Key、basic search、Markdown 正文、结果上限、5 URL 上限、usage credits、空正文过滤、非 2xx 稳定错误。

- [x] **Step 2: 运行测试并确认 RED**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts`

Expected: FAIL，模块不存在。

- [x] **Step 3: 实现最小 Tavily Provider**

使用注入的 `fetch` 和 Zod 响应 Schema；不记录 Provider body；将 credits 映射为集中费用估算。

- [x] **Step 4: 运行聚焦测试并确认 GREEN**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts`

Expected: PASS。

### Task 4: 实现 DeepSeek 结构化模型

**Files:**
- Create: `src/providers/live/deepseek-language-model.ts`
- Create: `src/providers/live/model-prompts.ts`
- Test: `tests/unit/live-providers.test.ts`

- [x] **Step 1: 写 JSON 与 usage 失败测试**

断言模型为 `deepseek-v4-flash`、关闭 thinking、`response_format=json_object`、prompt 标记网页数据不可信、请求包含 JSON Schema、输出经调用方 Zod 校验、费用区分输入和输出 token。

- [x] **Step 2: 运行测试并确认 RED**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts`

Expected: FAIL，DeepSeek 模块不存在。

- [x] **Step 3: 实现五类操作 prompt 和客户端**

使用 `z.toJSONSchema` 生成输出契约，严格 `JSON.parse`，非 2xx、空 choices、非法 JSON 或 Schema 不匹配都转换为稳定错误码。

- [x] **Step 4: 运行聚焦测试并确认 GREEN**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts`

Expected: PASS。

### Task 5: 实现百炼 Embedding

**Files:**
- Create: `src/providers/live/bailian-embedding-provider.ts`
- Test: `tests/unit/live-providers.test.ts`

- [x] **Step 1: 写维度、顺序和 batching 失败测试**

断言固定 `text-embedding-v4`、`dimensions=1536`、按 index 恢复输入顺序、批次 usage 累加、错误维度被拒绝。

- [x] **Step 2: 运行测试并确认 RED**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts`

Expected: FAIL，百炼模块不存在。

- [x] **Step 3: 实现最小 Embedding Provider**

使用百炼 OpenAI 兼容接口和注入 fetch；每批最多 10 条，输出由 Zod 校验为 1536 维。

- [x] **Step 4: 运行聚焦测试并确认 GREEN**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts`

Expected: PASS。

### Task 6: 运行时选择与 Provider 边界

**Files:**
- Create: `src/providers/runtime.ts`
- Modify: `src/inngest/functions/run-research.ts`
- Modify: `scripts/check-provider-boundary.mjs`
- Modify: `.env.example`
- Test: `tests/unit/live-providers.test.ts`
- Test: `tests/unit/provider-boundary.test.ts`

- [x] **Step 1: 写运行时与扫描失败测试**

覆盖 Production 强制 live、test 默认 fixture、live 缺任一 Key 失败；边界扫描只允许三个已审核 live 模块联网，继续拒绝其他 Provider 网络代码和客户端 Key。

- [x] **Step 2: 运行测试并确认 RED**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts tests/unit/provider-boundary.test.ts`

Expected: FAIL，runtime 不存在且扫描仍拒绝 live 模块。

- [x] **Step 3: 实现 runtime 并接入 Inngest**

Production 直接创建 live providers；非 Production 默认 fixtures。本地 live 需要 `RESEARCH_PROVIDER_MODE=live` 和专用确认令牌。

- [x] **Step 4: 更新边界扫描与环境变量模板**

加入 `DEEPSEEK_API_KEY`、`BAILIAN_API_KEY`，禁止任何 `NEXT_PUBLIC_*PROVIDER*` 变量和未列入允许清单的联网 Provider。

- [x] **Step 5: 运行聚焦测试并确认 GREEN**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts tests/unit/provider-boundary.test.ts tests/unit/inngest-research.test.ts`

Expected: PASS。

### Task 7: 专用真实冒烟门禁

**Files:**
- Create: `src/providers/live/smoke-gate.ts`
- Create: `tests/provider-smoke/live-providers.test.ts`
- Modify: `package.json`
- Modify: `docs/deployment.md`
- Test: `tests/unit/live-providers.test.ts`

- [x] **Step 1: 写确认令牌与成本上限失败测试**

无令牌、错误令牌、非数字、零值或高于 `0.10` 都必须在 fetch 前拒绝。

- [x] **Step 2: 运行测试并确认 RED**

Run: `npm run test:unit -- tests/unit/live-providers.test.ts`

Expected: FAIL，smoke gate 不存在。

- [x] **Step 3: 实现门禁和专用测试脚本**

`npm run test:providers:live` 依次发起一条 Tavily、一个 DeepSeek plan 和一个百炼 embedding 请求，累加 usage 后断言不超过显式上限；默认 test 因缺确认令牌跳过该文件。

- [x] **Step 4: 运行默认门禁**

Run: `npm run check:provider-boundary && npm run lint && npm run typecheck && npm run test:unit && npm run build`

Expected: PASS，且没有真实 Provider 请求。

### Task 8: 迁移 Embedding 模型元数据

**Files:**
- Create: `supabase/migrations/20260723000100_embedding_model_v4.sql`
- Modify: `supabase/tests/01_schema_constraints.sql`
- Modify: `src/features/research/domain.ts`
- Modify: `src/features/research/workflow-types.ts`
- Modify: `src/features/sources/source-utils.ts`
- Modify: `src/features/research/run-research-workflow.ts`
- Modify: `src/features/research/managed-workspace-store.ts`
- Modify: `src/features/research/supabase-workflow-writer.ts`
- Test: `tests/unit/research-domain.test.ts`
- Test: `tests/unit/research-workflow.test.ts`
- Test: `tests/unit/managed-workspace-store.test.ts`
- Test: `tests/unit/supabase-workflow-writer.test.ts`

- [x] **Step 1: 写数据库迁移失败测试**

pgTAP 断言显式 old 与 v4 均可写、新行默认 v4、未知模型继续拒绝；只应用旧迁移链时确认 v4 和默认值为 RED。

- [x] **Step 2: 实现兼容前向迁移**

保留 `text-embedding-3-small` 合法值，增加 `text-embedding-v4`，默认改为 v4；不得更新历史行或删除数据。

- [x] **Step 3: 写 TypeScript 模型兼容与一致性失败测试**

覆盖 managed 历史 old 与新 v4 读取、新 Chunk/workflow 只写 v4，以及 Durable Writer 在 Chunk/向量模型不一致时写入前拒绝。

- [x] **Step 4: 实现最小 Domain、Workflow 与 Writer 调整**

读取 Schema 接受 old/v4，新创建路径固定 v4；Writer 同时核对模型和维度后再持久化。

- [x] **Step 5: 运行数据库和聚焦单元测试并确认 GREEN**

Run: `npm run test:db && npm run test:unit -- tests/unit/research-domain.test.ts tests/unit/research-workflow.test.ts tests/unit/managed-workspace-store.test.ts tests/unit/supabase-workflow-writer.test.ts`

Expected: PASS，且本地迁移不连接 Production、不调用 Provider。

### Task 9: 凭据、真实冒烟与 PR 闭环

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/development-plan.md`

- [x] **Step 1: 安全准备本地 Key**

从已授权来源取得 Tavily Key、复用 `yiju/.env.local` 的 DeepSeek Key、在百炼控制台创建或读取 API Key；只写入权限 `0600` 的忽略文件，不打印值。

- [x] **Step 2: 执行低成本真实冒烟**

Run: `RESEARCH_PROVIDER_MODE=live ALLOW_PAID_PROVIDER_SMOKE=I_CONFIRM_PAID_PROVIDER_CALLS PAID_PROVIDER_SMOKE_COST_LIMIT_USD=0.10 npm run test:providers:live`

Expected: 三家请求通过，估算费用 `<= 0.10 USD`。

- [x] **Step 3: 跑完整模块门禁并更新状态**

Run: `npm run test:managed`

Expected: Provider 扫描、数据库、lint、typecheck、unit、build、E2E 全部通过，默认路径未调用真实 Provider。

- [ ] **Step 4: 提交并创建唯一 Draft PR**

使用中文 Conventional Commits，push `feat/real-provider-integration`，创建一个 Draft PR 并更新 `PROJECT_STATUS.md`。

- [ ] **Step 5: 完成独立审核与 CI**

Run: `claude --permission-mode auto --model sonnet -p "/codex-independent-pr-review <PR编号>"`

Expected: `CLAUDE_REVIEW_RESULT=pass` 且审核 SHA 等于当前 head；两个 GitHub CI job 成功后 merge commit 合并。

- [ ] **Step 6: 配置 Production 并验收**

把三类 Key 只写入 Vercel Production，重新部署并同步 Inngest。创建一个低范围中文研究，确认真实来源、ready 状态、主张、引文报告和费用记录；失败时停用 live 配置并按原部署回滚。
