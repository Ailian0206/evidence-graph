# 持久化研究结果实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让托管项目从原子创建研究运行、发送 Inngest 事件，到幂等保存确定性工作流结果并打开真实工作台形成完整闭环。

**Architecture:** 保留现有纯内存确定性工作流，在函数完成后把经过 Zod 和 owner/project/run 校验的快照按外键顺序写入 Supabase。数据库 RPC 负责原子创建、运行状态和用量差额；前台使用 RLS 客户端读取真实工作台，后台只在 Inngest Writer 中使用 Service Role。

**Tech Stack:** Next.js 16 App Router、TypeScript、Zod、Supabase JS/Postgres/RLS/pgTAP、Inngest、Vitest、Testing Library、Playwright。

---

## 文件结构

- `supabase/migrations/20260717000100_durable_research_results.sql`：研究输入、原子创建和幂等运行状态 RPC。
- `supabase/tests/03_durable_research_results.sql`：并发额度、跨租户、失败重试和用量幂等 pgTAP。
- `src/features/projects/project-store.ts`：研究创建返回项目与 run 的应用契约。
- `src/features/projects/supabase-project-repository.ts`：`create_managed_research` RPC adapter。
- `src/features/projects/actions.ts`：事务成功后投递事件和稳定错误映射。
- `src/features/research/supabase-workflow-writer.ts`：后台快照校验、依赖顺序写入和状态收口。
- `src/features/research/managed-workspace-store.ts`：RLS 工作台查询和 row 映射。
- `src/features/research/actions.ts`：持久化 Claim 审核状态。
- `src/components/evidence-workspace/managed-workspace-state.tsx`：queued/running/failed 状态和刷新。
- `src/app/[locale]/app/research/[id]/page.tsx`：demo 与真实工作台装配边界。
- `tests/unit/*`、`tests/e2e/*`：Repository、Writer、Store、UI 和路由回归。

### 任务 1：建立原子研究创建和幂等运行状态

**文件：**

- 创建：`supabase/migrations/20260717000100_durable_research_results.sql`
- 创建：`supabase/tests/03_durable_research_results.sql`

- [x] **步骤 1：编写数据库 RED 测试**

测试使用两个 Auth 用户，验证：

```sql
select lives_ok(
  $$ select * from public.create_managed_research(
    'project_durable_a',
    'run_durable_a',
    'Durable research',
    'How are workflow results persisted?',
    'en',
    'research-project-durable-a',
    '["https://example.com/source"]'::jsonb
  ) $$,
  'authenticated owner creates a project and queued run atomically'
);

select is(
  (select count(*) from public.research_runs where project_id = 'project_durable_a'),
  1::bigint,
  'atomic creation persists exactly one run'
);

select throws_ok(
  $$ select * from public.create_managed_research(
    'project_limit_4', 'run_limit_4', 'Fourth', 'Fourth?', 'en',
    'research-project-limit-4', '[]'::jsonb
  ) $$,
  'P0001',
  'MONTHLY_RUN_LIMIT_EXCEEDED',
  'the fourth monthly run is rejected inside the transaction'
);
```

继续验证 `begin_research_run` 的三个 ID 必须匹配、`fail_research_run` 保存稳定错误码、`finalize_research_run` 重复调用后 `usage_monthly.search_count/token_count/estimated_cost_usd` 不重复增加。

- [x] **步骤 2：运行数据库测试确认 RED**

运行：

```bash
npx supabase start -x studio,imgproxy,edge-runtime,gotrue,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,supavisor,vector
npx supabase db reset --local
npx supabase test db --local supabase/tests/03_durable_research_results.sql
```

预期：因迁移和 RPC 不存在失败。

- [x] **步骤 3：实现迁移和权限**

迁移必须包含：

```sql
alter table public.research_runs
add column manual_urls jsonb not null default '[]'::jsonb
check (
  jsonb_typeof(manual_urls) = 'array'
  and jsonb_array_length(manual_urls) <= 5
);

create function public.create_managed_research(
  requested_project_id text,
  requested_run_id text,
  requested_title text,
  requested_question text,
  requested_language text,
  requested_slug text,
  requested_manual_urls jsonb
)
returns table (project_id text, run_id text, project_slug text)
language plpgsql
set search_path = public
as $$
declare
  current_owner uuid := auth.uid();
  current_month date := date_trunc('month', now())::date;
begin
  if current_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if requested_language not in ('zh', 'en')
    or jsonb_typeof(requested_manual_urls) <> 'array'
    or jsonb_array_length(requested_manual_urls) > 5 then
    raise exception 'INVALID_RESEARCH_INPUT';
  end if;

  insert into public.usage_monthly (owner_id, month)
  values (current_owner, current_month)
  on conflict (owner_id, month) do nothing;

  update public.usage_monthly
  set run_count = run_count + 1
  where owner_id = current_owner
    and month = current_month
    and run_count < 3;

  if not found then
    raise exception 'MONTHLY_RUN_LIMIT_EXCEEDED';
  end if;

  insert into public.projects (
    id, owner_id, title, question, language, status, visibility, slug
  ) values (
    requested_project_id, current_owner, requested_title, requested_question,
    requested_language, 'active', 'private', requested_slug
  );

  insert into public.research_runs (
    id, project_id, owner_id, status, step, source_limit, manual_url_limit,
    manual_urls, max_content_chars, estimated_cost_usd, search_count, token_count
  ) values (
    requested_run_id, requested_project_id, current_owner, 'queued', 'queued',
    12, 5, requested_manual_urls, 200000, 0, 0, 0
  );

  return query select requested_project_id, requested_run_id, requested_slug;
end;
$$;
```

实现 `begin_research_run`、`fail_research_run` 和 `finalize_research_run`，三者只授予 `service_role`；`create_managed_research` 和只允许当前用户标记 queued run 的 `fail_owned_research_dispatch` 授予 `authenticated`。所有函数固定 `search_path`，撤销 `public/anon` 权限。

- [x] **步骤 4：验证 GREEN**

运行：

```bash
npx supabase db reset --local
npx supabase test db --local
npx supabase db lint --local --level warning
```

预期：原有 33 个测试和新增用例全部通过，Schema lint 无错误。

- [x] **步骤 5：提交**

```bash
git add supabase/migrations/20260717000100_durable_research_results.sql supabase/tests/03_durable_research_results.sql
git commit -m "feat(database): 增加持久化研究运行事务"
```

### 任务 2：原子创建项目并投递同一个 run

**文件：**

- 修改：`src/features/projects/project-store.ts`
- 修改：`src/features/projects/supabase-project-repository.ts`
- 创建：`src/features/projects/research-submission.ts`
- 修改：`src/features/projects/actions.ts`
- 修改：`tests/unit/supabase-project-repository.test.ts`
- 创建：`tests/unit/create-research-action.test.ts`

- [x] **步骤 1：编写 Repository 和 Action RED 测试**

Repository 测试要求一次 RPC 返回项目和 run：

```ts
await expect(
  store.createResearch({
    ownerId: "owner_1",
    input: {
      title: "Durable research",
      question: "How are results persisted?",
      language: "en",
      manualUrls: ["https://example.com/source"],
    },
  }),
).resolves.toMatchObject({
  project: { id: "project_1", ownerId: "owner_1" },
  run: { id: "run_1", projectId: "project_1", status: "queued" },
});
```

Action 测试要求调用顺序为 `requireUser -> createResearch -> sendEvent`；RPC 失败不发送事件；发送失败调用 `markResearchDispatchFailed` 并返回原项目和 run，不重复创建和计费。重投入口随任务 4 的运行状态工作台一起实现，并复用原 `runId`。

- [x] **步骤 2：运行测试确认 RED**

运行：

```bash
npm run test:unit -- tests/unit/supabase-project-repository.test.ts tests/unit/create-research-action.test.ts
```

预期：`createResearch` 契约和 Action helper 不存在。

- [x] **步骤 3：实现最小应用契约**

新增类型：

```ts
export type CreatedManagedResearch = {
  project: ManagedProject;
  run: ResearchRun;
};

export type ProjectStore = {
  listProjects: (input: { ownerId: string }) => Promise<ManagedProject[]>;
  getProject: (input: { ownerId: string; projectId: string }) => Promise<ManagedProject>;
  createResearch: (input: {
    ownerId: string;
    input: CreateResearchInput;
  }) => Promise<CreatedManagedResearch>;
  markResearchDispatchFailed: (input: {
    ownerId: string;
    projectId: string;
    runId: string;
  }) => Promise<void>;
  updateProject: (input: {
    ownerId: string;
    projectId: string;
    input: UpdateProjectInput;
  }) => Promise<ManagedProject>;
  deleteProject: (input: { ownerId: string; projectId: string }) => Promise<void>;
};
```

Supabase adapter 生成稳定的 `projectId`、`runId` 和 slug 后调用 `rpc("create_managed_research")`，再读取返回 ID 对应的项目和 run row。把 Action 核心提取为可注入依赖的 `submitManagedResearch`，生产入口注入 `sendResearchRequestedEvent`，测试注入 spy。

事务成功后跳转 `/${locale}/app/research/${project.id}`。事件发送失败时先把原 run 标记为 `RESEARCH_DISPATCH_FAILED`，再进入同一个项目工作台；创建表单只处理事务尚未成功的输入和月度额度错误。

- [x] **步骤 4：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/supabase-project-repository.test.ts tests/unit/create-research-action.test.ts
npm run typecheck
npx eslint src/features/projects/project-store.ts src/features/projects/supabase-project-repository.ts src/features/projects/research-submission.ts src/features/projects/actions.ts tests/unit/supabase-project-repository.test.ts tests/unit/create-research-action.test.ts
```

预期：RPC 参数、调用顺序、投递失败标记和类型边界全部通过，未连接真实 Inngest。

- [x] **步骤 5：提交**

```bash
git add src/features/projects tests/unit docs/superpowers/plans/2026-07-17-durable-research-results-plan.md
git commit -m "feat(projects): 创建研究运行并投递事件"
```

### 任务 3：幂等保存确定性工作流快照

**文件：**

- 创建：`src/features/research/supabase-workflow-writer.ts`
- 创建：`tests/unit/supabase-workflow-writer.test.ts`
- 修改：`src/inngest/functions/run-research.ts`
- 修改：`tests/unit/inngest-research.test.ts`

- [x] **步骤 1：编写 Writer RED 测试**

测试以 `createDemoResearchFixture` 和真实 `runResearchWorkflow` 结果构造快照，验证：

```ts
expect(queries.calls).toEqual([
  "beginRun",
  "upsertSources",
  "upsertChunks",
  "upsertClaims",
  "upsertEvidenceLinks",
  "upsertClaimRelations",
  "upsertCheckpoints",
  "upsertRunLogs",
  "upsertReport",
  "finalizeRun",
]);
```

把任一 source 的 `projectId` 改为其他项目时抛出 `WORKFLOW_PROJECT_MISMATCH`，且 `beginRun` 之后不执行任何 upsert。相同快照执行两次时 adapter 使用相同 conflict keys。

- [x] **步骤 2：运行测试确认 RED**

运行：

```bash
npm run test:unit -- tests/unit/supabase-workflow-writer.test.ts tests/unit/inngest-research.test.ts
```

预期：Writer 模块不存在。

- [x] **步骤 3：实现 Writer 和 Supabase adapter**

定义接口：

```ts
export type WorkflowPersistenceQueries = {
  beginRun: (event: ResearchRequestedEventData) => Promise<void>;
  upsertSources: (sources: Source[]) => Promise<void>;
  upsertChunks: (input: {
    chunks: SourceChunk[];
    embeddings: EmbeddedChunk[];
  }) => Promise<void>;
  upsertClaims: (claims: Claim[]) => Promise<void>;
  upsertEvidenceLinks: (links: EvidenceLink[]) => Promise<void>;
  upsertClaimRelations: (relations: ClaimRelation[]) => Promise<void>;
  upsertCheckpoints: (input: {
    projectId: string;
    checkpoints: WorkflowCheckpoint[];
  }) => Promise<void>;
  upsertRunLogs: (input: {
    projectId: string;
    entries: RunLogEntry[];
  }) => Promise<void>;
  upsertReport: (report: ResearchReport | null) => Promise<void>;
  finalizeRun: (input: ResearchRequestedEventData & {
    searchCount: number;
    tokenCount: number;
    estimatedCostUsd: number;
  }) => Promise<void>;
  failRun: (input: ResearchRequestedEventData & { errorCode: string }) => Promise<void>;
};

export type DurableWorkflowWriter = {
  begin: (event: ResearchRequestedEventData) => Promise<void>;
  persist: (input: {
    event: ResearchRequestedEventData;
    snapshot: ResearchWorkflowSnapshot;
  }) => Promise<void>;
  fail: (input: ResearchRequestedEventData & { errorCode: string }) => Promise<void>;
};
```

每批 upsert 显式声明数据库 conflict key；embedding 序列化为 pgvector 接受的 `[n,n,...]` 字符串。报告保存为 `status = "draft"`、`slug = null`、`published_at = null`。

修改 Inngest 执行器：授权后在 durable step 内调用 `writer.begin(event)`，再创建只含项目和 run 的空结果 Store、执行 workflow、读取 `store.getSnapshot()` 并调用 `writer.persist(...)`；异常时调用 `writer.fail(...)` 后继续抛出，让现有 3 次重试生效。Handler 测试固定调用顺序为 `authorize -> step -> begin -> execute -> persist`。

- [x] **步骤 4：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/supabase-workflow-writer.test.ts tests/unit/inngest-research.test.ts tests/unit/research-workflow.test.ts
```

预期：Writer 顺序、边界、错误处理通过，现有确定性工作流测试不变。

- [x] **步骤 5：提交**

```bash
git add src/features/research/supabase-workflow-writer.ts src/inngest/functions/run-research.ts tests/unit
git commit -m "feat(workflow): 持久化确定性研究结果"
```

### 任务 4：读取真实工作台数据

**文件：**

- 创建：`src/features/research/managed-workspace-store.ts`
- 创建：`tests/unit/managed-workspace-store.test.ts`
- 修改：`src/features/projects/research-submission.ts`
- 修改：`src/features/projects/actions.ts`
- 修改：`src/app/[locale]/app/research/[id]/page.tsx`
- 修改：`src/components/projects/project-dashboard.tsx`
- 修改：`src/components/projects/project-workspace.module.css`
- 创建：`src/components/evidence-workspace/managed-workspace-state.tsx`
- 修改：`tests/unit/create-research-action.test.ts`
- 修改：`tests/unit/evidence-workspace-ui.test.tsx`
- 修改：`tests/unit/project-workspace-ui.test.tsx`
- 修改：`messages/zh.json`
- 修改：`messages/en.json`

- [x] **步骤 1：编写 Store RED 测试**

使用可注入 Query adapter 验证：

```ts
await expect(store.load({ ownerId: "owner_1", projectId: "project_1", locale: "zh" }))
  .resolves.toMatchObject({ state: "ready", data: { project: { id: "project_1" } } });

await expect(store.load({ ownerId: "owner_1", projectId: "missing", locale: "zh" }))
  .resolves.toEqual({ state: "not-found" });
```

分别覆盖 queued、running、failed、ready；所有 list 查询必须携带 `projectId`，run 查询同时携带 `ownerId`。

- [x] **步骤 2：运行测试确认 RED**

运行：

```bash
npm run test:unit -- tests/unit/managed-workspace-store.test.ts
```

预期：Store 模块不存在。

- [x] **步骤 3：实现显式 row 映射和页面装配**

Store 返回：

```ts
export type ManagedWorkspaceResult =
  | { state: "queued" | "running"; runId: string }
  | { state: "failed"; runId: string; errorCode: string | null; canRetryDispatch: boolean }
  | { state: "ready"; data: EvidenceWorkspaceData }
  | { state: "not-found" };
```

非 `demo` 页面先 `requireManagedUser`，再创建 Supabase Server Client 和 Store。`not-found` 调用 `notFound()`；queued/running/failed 渲染固定尺寸状态；ready 渲染现有 `EvidenceWorkspace`。状态组件在 queued/running 时每 3 秒 `router.refresh()`，组件卸载时清理定时器；只有 `canRetryDispatch` 为 true 时显示重投按钮。重投前重新认证并验证原 run 的失败码，成功后复用相同事件 ID 进入轮询，不创建项目或增加额度。Dashboard 的项目标题链接到 `/app/research/{projectId}`，归档和删除按钮保持独立操作。

- [x] **步骤 4：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/managed-workspace-store.test.ts tests/unit/evidence-workspace-ui.test.tsx tests/unit/project-workspace-ui.test.tsx tests/unit/create-research-action.test.ts
npm run typecheck
npm run build
npx playwright test tests/e2e/auth-boundary.spec.ts tests/e2e/evidence-workspace.spec.ts
```

预期：真实路由保持登录边界，demo 和工作台行为不回归。

- [x] **步骤 5：提交**

```bash
git add src/features/research/managed-workspace-store.ts src/app/[locale]/app/research/[id]/page.tsx src/components/evidence-workspace src/components/projects messages tests
git commit -m "feat(workspace): 读取持久化研究结果"
```

### 任务 5：持久化 Claim 审核状态

**文件：**

- 创建：`src/features/research/claim-review.ts`
- 创建：`src/features/research/actions.ts`
- 修改：`src/components/evidence-workspace/evidence-workspace.tsx`
- 修改：`src/components/evidence-workspace/evidence-workspace.module.css`
- 修改：`src/app/[locale]/app/research/[id]/page.tsx`
- 修改：`messages/zh.json`
- 修改：`messages/en.json`
- 修改：`tests/unit/evidence-workspace-ui.test.tsx`
- 创建：`tests/unit/review-claim-action.test.ts`

- [x] **步骤 1：编写审核 RED 测试**

Action 测试验证 `requireUser` 先执行，更新查询包含 `claimId + projectId`，非法状态被 Zod 拒绝。UI 测试验证成功后保留新状态，失败后恢复旧状态并允许重试；demo 模式不调用 Server Action。

- [x] **步骤 2：运行测试确认 RED**

运行：

```bash
npm run test:unit -- tests/unit/review-claim-action.test.ts tests/unit/evidence-workspace-ui.test.tsx
```

预期：审核 Action 和持久化模式不存在。

- [x] **步骤 3：实现审核边界**

输入 Schema：

```ts
const reviewManagedClaimInputSchema = z.object({
  projectId: z.string().min(1),
  claimId: z.string().min(1),
  reviewStatus: claimReviewStatusSchema,
});
```

Server Action 重新读取用户并使用 RLS Server Client 更新：

```ts
client
  .from("claims")
  .update({ review_status: reviewStatus })
  .eq("id", claimId)
  .eq("project_id", projectId)
  .select("id")
  .maybeSingle();
```

`EvidenceWorkspace` 增加 `persistence: "demo" | "managed"`。managed 模式使用 `useTransition` 调用 Action，先乐观更新，失败后只回滚目标 Claim 并显示本地化错误；demo 模式保持现有纯客户端行为。

- [x] **步骤 4：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/review-claim-action.test.ts tests/unit/evidence-workspace-ui.test.tsx
npm run typecheck
npx eslint src/features/research/claim-review.ts src/features/research/actions.ts src/components/evidence-workspace/evidence-workspace.tsx tests/unit/review-claim-action.test.ts tests/unit/evidence-workspace-ui.test.tsx
npx playwright test tests/e2e/evidence-workspace.spec.ts
```

预期：审核状态持久化和 demo 回归测试通过。

- [x] **步骤 5：提交**

```bash
git add src/features/research/claim-review.ts src/features/research/actions.ts src/components/evidence-workspace src/app/[locale]/app/research/[id]/page.tsx messages tests
git commit -m "feat(claims): 持久化人工审核状态"
```

### 任务 6：更新计划状态并执行模块门禁

**文件：**

- 修改：`docs/development-plan.md`
- 修改：`PROJECT_STATUS.md`
- 修改：`docs/superpowers/plans/2026-07-17-durable-research-results-plan.md`

- [x] **步骤 1：运行聚焦集成验证**

运行：

```bash
npm run check:provider-boundary
npm run test:db
npm run test:unit -- tests/unit/supabase-project-repository.test.ts tests/unit/create-research-action.test.ts tests/unit/supabase-workflow-writer.test.ts tests/unit/managed-workspace-store.test.ts tests/unit/review-claim-action.test.ts tests/unit/inngest-research.test.ts tests/unit/evidence-workspace-ui.test.tsx
npx playwright test tests/e2e/auth-boundary.spec.ts tests/e2e/evidence-workspace.spec.ts tests/e2e/project-dashboard.spec.ts tests/e2e/inngest-route.spec.ts
```

预期：数据库、事件、Writer、工作台和审核闭环通过，不发送真实 Provider 请求。

- [x] **步骤 2：运行完整门禁**

运行：

```bash
npm run test:managed
```

预期：Provider 扫描、数据库测试、Schema lint、lint、typecheck、全部单元测试、生产构建和全部 E2E 通过。

- [x] **步骤 3：更新中文状态文档**

在 `docs/development-plan.md` 增加 `feat/durable-research-results` 模块；在 `PROJECT_STATUS.md` 记录分支、验证数量、fixture-only Provider 状态以及“等待托管部署 PR 合并后才创建本模块 PR”。把本计划已完成步骤改为 `[x]`。

- [x] **步骤 4：提交状态**

```bash
git add docs/development-plan.md PROJECT_STATUS.md docs/superpowers/plans/2026-07-17-durable-research-results-plan.md
git commit -m "docs(status): 记录持久化研究结果验证"
```

- [x] **步骤 5：检查分支但不创建 PR**

运行：

```bash
git diff --check feat/managed-deployment...HEAD
git status --short
git log --oneline feat/managed-deployment..HEAD
```

预期：工作树干净、提交只属于本模块。Vercel 审核完成前不 push 本分支、不创建 PR；先回到 `feat/managed-deployment` 完成部署闭环。

### 任务 7：对齐父模块并闭环唯一 Draft PR

- [x] **步骤 1：以 merge commit 对齐最新 `main` 并解决冲突**
- [x] **步骤 2：重新运行 `npm run test:managed`**
- [x] **步骤 3：检查差异、推送分支并创建唯一 Draft PR**
- [ ] **步骤 4：执行独立 Claude 审核、CI 和 merge commit 闭环**
