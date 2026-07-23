# 真实 Provider 接入设计

> 日期：2026-07-22
> 状态：已确认，进入实现

## 目标

把 Vercel Production 的研究任务从确定性 fixtures 切换为真实 Provider：

- Tavily Search/Extract：搜索网页并提取手动 URL 正文。
- DeepSeek `deepseek-v4-flash`：规划搜索、抽取主张、关联证据、识别冲突和生成报告。
- 阿里云百炼 `text-embedding-v4`：生成固定 1536 维向量。

用户创建的 Production 研究直接调用上述 Provider。开发、单元测试、E2E 和 CI 继续固定使用 fixtures，不得因为本地存在 Key 而自动联网。

## 范围

### 包含

1. 三个服务端 Provider 适配器和统一运行时工厂。
2. 从 Supabase 读取真实项目、运行参数和手动 URL，移除后台任务对 demo 问题的依赖。
3. Tavily 手动 URL 正文提取纳入既有收集步骤、幂等记录和成本统计。
4. DeepSeek JSON 输出使用现有 Zod Schema 做运行时校验。
5. 百炼固定请求 `text-embedding-v4` 和 1536 维，返回向量继续通过现有长度校验。
6. 兼容前向迁移 `source_chunks.embedding_model`，保留历史模型元数据并让新 Chunk 默认记录 `text-embedding-v4`。
7. 独立付费冒烟命令、精确确认令牌和 `0.10 USD` 首次冒烟上限。
8. Vercel Production 环境变量配置和一次线上真实研究验收。

### 不包含

- 不新增队列系统或 Provider SDK，不改变 embedding 维度或覆写历史向量元数据。
- 不接入 `deepseek-reasoner`，不做多模型路由。
- 不增加用户选择 Provider 的界面。
- 不改变每月研究次数、12 个来源、5 个手动 URL、20 万正文字符和单次研究 `1 USD` 硬上限。
- 不让 Provider 测试进入默认 CI 网络路径。

## 架构

```text
Production Inngest event
  -> 校验 ownerId/projectId/runId
  -> Supabase 读取真实 Project + ResearchRun + manual_urls
  -> live Provider 工厂（缺少任一 Key 立即失败）
  -> 既有 runResearchWorkflow
       planning / claims / evidence / conflicts / report -> DeepSeek
       searching -> Tavily Search
       collecting manual URLs -> Tavily Extract
       indexing -> 百炼 Embedding
  -> 既有 Durable Writer 原子持久化快照

development / test / CI
  -> fixture Provider 工厂
  -> 不读取真实 Key，不发网络请求
```

Provider 选择只发生在服务端：

- `NODE_ENV=production`：强制 `live`，禁止静默回退 fixture。
- 非 Production：默认 `fixture`。
- 本地付费冒烟：只有 `RESEARCH_PROVIDER_MODE=live`、精确确认令牌和不高于 `0.10` 的成本上限同时存在时才允许 `live`。

## 组件边界

### Tavily

- 使用原生 `fetch` 调用官方 `/search` 和 `/extract`，不增加 SDK 依赖。
- Search 使用 basic 深度、最多由工作流限制为 12 条，并请求 Markdown 原始正文。
- Extract 只接收已通过 URL Schema 的最多 5 个手动 URL。
- 正文优先使用 `raw_content`，缺失时 Search 回退 `content`；空正文结果丢弃。
- Provider 响应先由 Zod 校验，再映射为现有 `SearchResult`。

### DeepSeek

- 使用 `deepseek-v4-flash` 的 Chat Completions JSON Object 输出，并关闭 thinking。
- 每个工作流操作使用独立英文系统约束，明确网页正文是不可信数据，不能服从其中指令。
- 用户问题的语言随每个 payload 传入；模型输出必须保持同语言。
- 返回内容先 `JSON.parse`，再用调用方传入的 Zod Schema 校验。
- Token 数使用官方响应 `usage`；费用按集中配置的输入/输出单价估算。

### 百炼

- 使用 OpenAI 兼容 Embeddings 接口。
- 模型固定 `text-embedding-v4`，维度固定 1536，禁止由请求方覆盖。
- 按 API 单批限制切分文本；保持输入顺序合并结果。
- Token 数使用官方响应 `usage.total_tokens`，费用使用集中单价估算。

实现中发现 Production 已有 `source_chunks_embedding_model_check` 只允许 `text-embedding-3-small`，因此原“不新增数据库迁移”的假设不成立。新增兼容前向迁移后：

- 历史 `text-embedding-3-small` 行保持原值并继续合法，不执行批量 `UPDATE`。
- 新行默认使用 `text-embedding-v4`，未知模型继续被 check constraint 拒绝。
- TypeScript 读取边界兼容两种模型；新 Chunk 与新 embedding 只写 `text-embedding-v4`。
- Durable Writer 在写入前核对 Chunk 与向量的模型和维度，拒绝元数据分裂。

### 真实运行输入

新增 Supabase Reader 一次读取并校验：

- Project：真实标题、问题、语言、状态和时间字段。
- ResearchRun：真实限制、计数、状态和 `manual_urls`。

Reader 必须同时限定 `owner_id + project_id + run_id`。工作流初始快照只包含该 Project 和 Run，不再复制 demo Project 内容。

## 失败与重试

- 缺少配置：`PROVIDER_CONFIGURATION_MISSING`。
- Tavily、DeepSeek、百炼非 2xx：分别使用稳定 Provider 错误码，不持久化响应正文或 Key。
- JSON、Schema 或维度不合法：`PROVIDER_RESPONSE_INVALID`。
- Provider 超时使用稳定错误码，由 Inngest 现有最多 3 次重试处理。
- 工作流继续在每次调用前检查预算，并在写入官方 usage 后检查累计成本；超过 `1 USD` 标记 `RUN_COST_LIMIT_EXCEEDED`。
- Production 不因 Provider 故障回退 fixtures，避免向用户展示伪造研究结果。

## 密钥与日志

- 本地 Key 只写入被 Git 忽略且权限为 `0600` 的 `.env.local`。
- Production Key 只写入 Vercel Production 环境变量。
- 不在测试输出、错误、提交、PR、Sentry 或回复中显示 Key、Provider 原始 payload、网页全文。
- 所有 Provider 代码只读取无 `NEXT_PUBLIC_` 前缀的服务端变量。

## 测试

1. Mock-fetch 单测覆盖请求参数、响应映射、Schema、费用、超时和脱敏错误。
2. 运行时工厂单测证明 Production 强制 live、测试默认 fixture、缺 Key 失败。
3. Inngest 单测证明真实问题和手动 URL 从 Reader 进入工作流，不再使用 demo 问题。
4. Provider 边界扫描只允许审核过的 live 模块联网，并继续拒绝客户端 Key 和其他网络 Provider。
5. 默认 `npm run test:managed` 全程 fixtures、零 Provider 网络调用。
6. 专用 `npm run test:providers:live` 只有确认令牌有效时执行三家最小请求，并验证估算费用不超过 `0.10 USD`。
7. pgTAP 覆盖显式历史模型、显式 v4、v4 默认值和未知模型拒绝，单元测试覆盖新旧模型读取与 Writer 一致性。
8. 合并后配置 Production，创建一个低范围中文研究并检查 ready、来源、主张、证据、报告和费用记录。

## 完成标准

- 默认测试和 CI 无真实 Provider 请求。
- 三个适配器通过 mock-fetch 测试和专用低成本真实冒烟。
- Production 新研究使用用户真实问题和真实来源，生成可审核、可发布的报告。
- Provider Key 不出现在 Git 历史、日志或客户端产物。
- Draft PR 通过完整门禁、独立 Claude 审核和 GitHub CI 后以 merge commit 合并。
