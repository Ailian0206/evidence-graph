# 持久化研究结果设计

## 背景

托管部署分支已经具备 Supabase 项目、研究运行、来源、主张、证据、报告等表，也具备 Inngest 事件入口和确定性研究工作流。但当前新建研究只插入 `projects`，不会创建 `research_runs` 或发送事件；Inngest 函数执行后把结果保存在内存 Store 中，函数结束即丢失；非 `demo` 工作台完成登录校验后直接返回 404。

报告发布必须建立在真实、可恢复、受 RLS 保护的研究结果之上。本模块先补齐这层持久化闭环，再进入报告发布里程碑。

## 决策

采用“纯工作流继续在内存中确定性执行，完成后把完整快照幂等写入 Supabase”的方案。

没有采用以下方案：

- 不把现有工作流 Store 全部改成异步数据库 Store。该改动会侵入每个步骤，扩大回归范围，而且当前 fixtures 数据量很小。
- 不把持久化研究结果和公开报告发布放进同一个分支。两者属于独立用户闭环，合并后 PR 范围过大。
- 不增加静态报告页冒充真实发布流程。公开页面必须来自受验证的持久化快照。

## 目标

1. 用户提交新研究后，项目、研究运行和月度次数在一个数据库事务中创建。
2. 数据提交成功后发送唯一 Inngest 事件，`runId` 同时作为事件 ID 和函数幂等键。
3. Inngest 继续使用 fixture providers，不调用 OpenAI、Tavily 或其他网络 Provider。
4. 工作流结果按依赖顺序写入 Supabase，重复执行不会产生重复来源、主张、日志、报告或用量。
5. 登录用户可以打开自己的非 `demo` 项目，查看真实保存的工作台数据和运行状态。
6. Claim 接受、拒绝和恢复待审核会写回 Supabase，刷新页面后保持不变。
7. 任意读取和修改都重新校验当前用户、项目和运行所有权；Service Role 只用于 Inngest 后台写入。

## 不包含

- 真实 OpenAI、Tavily、Embedding Provider 或付费请求。
- 报告发布、撤销、稳定 slug、公开分享页和版本切换。
- 三个真实研究案例、首页媒体替换和作品集 Case Study 回填。
- 团队、计费、定时任务或新的外部服务。

## 用户流程

1. 用户在新建研究表单提交标题、问题、语言和最多 5 个 URL。
2. Server Action 重新读取登录用户并调用数据库函数，原子创建 `projects`、`research_runs` 和当月用量记录。
3. Server Action 在事务成功后发送 `evidence/research.requested`，然后跳转到新项目工作台。
4. 工作台在 `queued/running` 时显示稳定的处理中状态并定时刷新；`failed` 时显示错误状态和重试命令；`ready` 时显示主张、图谱、来源和运行日志。
5. 用户修改 Claim 审核状态时，客户端先进入 pending 状态，Server Action 成功后更新本地状态并刷新；失败时恢复原状态并显示可重试错误。

## 数据库边界

新增迁移，不修改已经应用的历史迁移。

### 原子创建

新增 `public.create_managed_research(...)` 数据库函数：

- 使用 `auth.uid()` 作为唯一 owner，不接受调用者传入 owner ID。
- 校验标题、问题、语言和最多 5 个 URL。
- 锁定当前 owner 的当月 `usage_monthly` 记录；`run_count >= 3` 时抛出 `MONTHLY_RUN_LIMIT_EXCEEDED`。
- 在同一事务插入项目、`queued` 运行并增加 `run_count`。
- 返回项目 ID、运行 ID 和项目 slug。

`research_runs` 增加 `manual_urls jsonb`，保存已校验的输入 URL，默认空数组。

### 运行状态

新增三个只授予 Service Role 的数据库函数：

- `public.begin_research_run(owner_id, project_id, run_id)` 只允许三个 ID 与已有记录完全一致，然后把 `queued/failed` 更新为 `running`。
- `public.finalize_research_run(owner_id, project_id, run_id, search_count, token_count, estimated_cost_usd)` 把 step 和 status 原子更新为最终值，并按已有 run 值计算月度用量差额，重复完成不会重复累计。
- `public.fail_research_run(owner_id, project_id, run_id, error_code)` 保存稳定错误码并把状态设为 `failed`；Inngest 重试可再次调用 `begin_research_run`。

### 快照写入

后台 Writer 在写入前解析所有领域 Schema，并确认每条数据都属于事件的 `projectId`，运行还必须属于 `ownerId`。按以下顺序 upsert：

1. `sources`
2. `source_chunks` 与 embedding
3. `claims`
4. `evidence_links`
5. `claim_relations`
6. `workflow_checkpoints`
7. `run_logs`
8. `reports` 草稿
9. 最终运行状态和月度用量

数据库现有复合外键、精确 Quote 触发器、项目内唯一约束和 RLS 继续作为最终防线。最终运行状态最后写入，避免部分结果被标记为 ready。

## 应用边界

### 研究创建

`ProjectStore` 增加返回项目和运行的研究创建能力。Supabase adapter 使用 `rpc("create_managed_research")`，不再通过“先查次数、再插项目”的非原子流程创建研究。Server Action 接收可注入的事件发送器，单元测试只使用 spy，不连接 Inngest。

事务成功但事件投递失败时，调用 `fail_research_run` 把原 run 标记为 `RESEARCH_DISPATCH_FAILED`。再次投递复用相同 `runId`，不会创建第二个项目或消耗第二次月度额度。

### Inngest 持久化

Inngest handler 保留授权先于执行的顺序。确定性工作流完成后，从内存 Store 读取快照并调用 Supabase Writer；Writer 成功后才返回 ready。所有 ID 从事件和现有确定性生成规则派生，保证同一事件重试得到相同数据键。

### 工作台读取

新增 `EvidenceWorkspaceStore`：

- 使用当前用户的 Supabase Server Client 和 RLS 读取项目、最新运行及其来源、Chunk、Claim、Evidence Link、Claim Relation 和 Run Log。
- 项目不存在或不属于当前用户时统一返回 `WORKSPACE_NOT_FOUND`，不泄露资源是否存在。
- queued/running/failed 只返回最小运行状态，不提前返回部分研究正文。
- ready 时把 snake_case row 显式映射为现有 `EvidenceWorkspaceData`，不让数据库 row 进入组件。

`demo` 路由继续使用现有静态 fixture，不连接 Supabase。

### Claim 审核

新增审核 Server Action，重新执行 `requireManagedUser`，解析 `projectId`、`claimId` 和目标状态后更新 Claim。更新查询同时限定 Claim ID 和 Project ID，并依赖 RLS 校验 owner。Demo 工作台继续使用纯客户端状态，不写数据库。

## 错误处理

- `MONTHLY_RUN_LIMIT_EXCEEDED`：表单显示现有月度额度文案。
- `RESEARCH_DISPATCH_FAILED`：项目和 queued run 保留，工作台显示投递失败和重试操作。
- `RUN_PROJECT_MISMATCH`：不可重试，不写任何结果。
- 数据库约束或持久化失败：run 标记为 failed，Inngest 按现有最多 3 次策略重试。
- `WORKSPACE_NOT_FOUND`：返回本地化 404 状态，不区分不存在和越权。
- Claim 审核失败：不覆盖模型原始 statement，界面恢复到服务端确认前状态。

## 界面约束

- 沿用现有 Evidence Workspace，不重新设计图谱和四面板结构。
- queued/running/failed/empty 状态使用现有稳定尺寸，不让轮询文本改变布局。
- Dashboard 项目入口直接指向 `/{locale}/app/research/{projectId}`。
- 移动端继续使用现有四个 Tabs；本模块不增加新的主导航项。
- 所有新增用户文案支持中文和英文；代码注释保持英文。

## 安全与成本

- 日常测试和本模块运行只使用 fixture providers。
- 客户端不读取 Service Role、Inngest Signing Key 或研究来源正文之外的后台字段。
- Admin Writer 每次写入前复核 owner/project/run，不能只依赖事件签名。
- 不把环境变量、Provider payload、来源正文或密钥写入日志、测试快照和 Sentry。
- 本模块不会触发真实 OpenAI/Tavily 调用，估算成本保持 fixtures 的确定性值。

## 验证标准

1. pgTAP 验证原子创建、月度上限、跨租户拒绝、重复最终化不重复累计用量。
2. 单元测试验证快照 Schema、项目边界、写入顺序、幂等重试和错误映射。
3. 单元测试验证 Server Action 只在事务成功后发送事件，投递失败复用同一 run。
4. 工作台 Store 测试验证 queued/running/failed/ready 和 snake_case 映射。
5. UI 测试验证运行状态、持久化审核和失败回滚。
6. Playwright 验证未登录边界、demo 不回归和真实项目路由契约。
7. 完整门禁通过 `npm run test:managed`，Provider 扫描确认没有真实 Provider 实现或端点。

## 分支关系

`feat/durable-research-results` 从尚未合并的 `feat/managed-deployment` 创建，只做本地提交，不创建 PR。Vercel 审核通过后，先完成并合并托管部署 PR；因为后续分支包含相同父提交，托管分支 merge commit 进入 main 后，后续 PR 只显示本模块新增差异，不需要 rebase 或 force push。
