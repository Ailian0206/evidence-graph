# 报告发布实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 为持久化报告增加原子发布、版本切换、撤销、稳定分享链接和无需登录的只读公开报告页。

**架构：** PostgreSQL RPC 负责所有发布状态转换、项目可见性和审计事务；Report Store 负责 Supabase 行映射和公开读取边界；Server Actions 重新认证并只提交 ID；现有工作台中栏增加报告模式，`/r/[slug]` 使用独立 root layout 展示单语言快照。测试继续使用 fixtures，不调用真实 Provider。

**技术栈：** PostgreSQL、pgTAP、Supabase JS、Next.js 16 App Router、React、TypeScript、Zod、next-intl、Vitest、Testing Library、Playwright。

---

### 任务 1：原子报告发布状态机

**文件：**

- 创建：`supabase/migrations/20260717000200_report_publishing.sql`
- 创建：`supabase/tests/04_report_publishing.sql`

- [x] **步骤 1：编写发布、切换和撤销 RED 数据库测试**

测试创建两个 owner、一个包含 v1/v2 的目标项目和一个其他 owner 项目。每份可发布报告至少包含下面的结构：

```sql
'[{"id":"section_1","heading":"Finding","factual":true,"markdown":"Finding [link_1]","citationIds":["link_1"]}]'::jsonb

'[{"evidenceLinkId":"link_1","claimId":"claim_1","chunkId":"chunk_1","sourceId":"source_1","quote":"Exact quote","sourceUrl":"https://example.com/source","sourceTitle":"Source"}]'::jsonb
```

断言：

```sql
select lives_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_v1') $$,
  'owner can publish a complete report version'
);

select is(
  (select slug from public.reports where id = 'publish_report_v1'),
  'publish-project',
  'published version receives the stable project slug'
);

select lives_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_v2') $$,
  'owner can switch the stable link to another version'
);

select lives_ok(
  $$ select * from public.revoke_published_report('publish_project') $$,
  'owner can revoke the current public version'
);
```

补充断言覆盖：同项目最多一个 `published`；旧版本清空 slug；重复发布和重复撤销不重复写审计；其他 owner 返回 `REPORT_NOT_FOUND`；缺失 Citation 的事实章节返回 `REPORT_NOT_PUBLISHABLE`；匿名读取只返回当前版本，撤销后返回 0 行。

- [x] **步骤 2：运行数据库测试确认 RED**

运行：

```bash
npx supabase db reset --local
npx supabase test db --local
```

预期：`04_report_publishing.sql` 因 `publish_report_version` 和 `revoke_published_report` 不存在而失败。

- [x] **步骤 3：实现最小数据库迁移**

迁移包含：

```sql
create unique index reports_one_published_per_project_idx
  on public.reports (project_id)
  where status = 'published';

create function public.publish_report_version(
  requested_project_id text,
  requested_report_id text
)
returns table (
  report_id text,
  project_slug text,
  report_version integer,
  report_status text,
  report_published_at timestamptz
)
language plpgsql
set search_path = ''
as $$
-- Lock the owned project and report, validate JSON snapshots, revoke the old
-- version, assign the project slug to the target, and write one audit event.
$$;

create function public.revoke_published_report(requested_project_id text)
returns table (project_slug text, revoked_report_id text)
language plpgsql
set search_path = ''
as $$
-- Lock the owned project, revoke the current version, clear its slug, make the
-- project private, and write one audit event.
$$;
```

发布完整性用 `jsonb_array_elements` 校验 factual section 的 `citationIds`，并确认每个 ID 存在于 `citations[].evidenceLinkId`。两个函数从 `auth.uid()` 推导 owner，撤销 public/anon 权限，只向 authenticated 和 service_role 授权。

更新 `get_public_report(text)` 的返回列，增加 `language`，并继续限制 active、public、published 和非空发布时间。

- [x] **步骤 4：验证 GREEN 和 Schema lint**

运行：

```bash
npx supabase db reset --local
npx supabase test db --local
npx supabase db lint --local --level warning
```

预期：原有 51 个 pgTAP 与新增发布测试全部通过，Schema lint 无 warning。

- [x] **步骤 5：提交数据库状态机**

```bash
git add supabase/migrations/20260717000200_report_publishing.sql supabase/tests/04_report_publishing.sql
git commit -m "feat(database): 增加报告发布状态机"
```

### 任务 2：Report Store、公开读取和确定性 fixtures

**文件：**

- 创建：`src/features/reports/report-store.ts`
- 创建：`src/features/reports/report-fixture.ts`
- 创建：`tests/unit/report-store.test.ts`
- 修改：`src/features/research/evidence-workspace.ts`
- 修改：`src/features/research/evidence-workspace-fixture.ts`
- 修改：`src/features/research/managed-workspace-store.ts`
- 修改：`tests/unit/managed-workspace-store.test.ts`

- [x] **步骤 1：编写 Report Store RED 单元测试**

定义期望领域对象：

```ts
const report = {
  id: "report_v2",
  runId: "run_2",
  projectId: "project_1",
  slug: "research-project-1",
  markdown: "## Finding\n\nFinding [link_1]",
  sections: [
    {
      id: "section_1",
      heading: "Finding",
      factual: true,
      markdown: "Finding [link_1]",
      citationIds: ["link_1"],
    },
  ],
  citations: [
    {
      evidenceLinkId: "link_1",
      claimId: "claim_1",
      chunkId: "chunk_1",
      sourceId: "source_1",
      quote: "Exact quote",
      sourceUrl: "https://example.com/source",
      sourceTitle: "Source",
    },
  ],
  version: 2,
  status: "published",
  publishedAt: "2026-07-17T10:00:00.000Z",
  createdAt: "2026-07-17T09:00:00.000Z",
};
```

测试以下契约：

```ts
await expect(store.listVersions({ ownerId: "owner_1", projectId: "project_1" }))
  .resolves.toEqual([reportV2, reportV1]);

await expect(store.publish({ ownerId: "owner_1", projectId: "project_1", reportId: "report_v2" }))
  .resolves.toMatchObject({ slug: "research-project-1", version: 2, status: "published" });

await expect(store.getPublicReport({ slug: "research-project-1" }))
  .resolves.toMatchObject({ language: "zh", report: reportV2 });
```

同时测试 malformed sections/citations 被 Zod 拒绝、空 RPC 结果映射为 `REPORT_NOT_FOUND`，以及 fixture slug 在无 Supabase 环境下可读取。

- [x] **步骤 2：运行单元测试确认 RED**

运行：

```bash
npm run test:unit -- tests/unit/report-store.test.ts tests/unit/managed-workspace-store.test.ts
```

预期：`report-store`、报告 Query Adapter 和工作台 `reports` 字段不存在。

- [x] **步骤 3：实现报告 Schema 和 Store**

核心 Schema：

```ts
export const reportStatusSchema = z.enum(["draft", "published", "revoked"]);

export const publishableReportSchema = researchReportSchema.extend({
  slug: z.string().min(1).optional(),
  status: reportStatusSchema,
  publishedAt: z.string().datetime().optional(),
});

export const publicReportSchema = z.object({
  language: z.enum(["zh", "en"]),
  title: z.string().min(1),
  question: z.string().min(1),
  report: publishableReportSchema.extend({
    slug: z.string().min(1),
    status: z.literal("published"),
    publishedAt: z.string().datetime(),
  }),
});
```

`ReportQueryAdapter` 提供 `listVersions`、`publish`、`revoke` 和 `getPublicReport`。Supabase 实现显式选择报告列、按 version 降序读取，并调用三个 RPC。`getPublicReport` 先读取中英文 fixture，再在 `isSupabasePublicConfigured()` 为 true 时创建匿名 Server Client。

- [x] **步骤 4：让 ready 工作台读取报告版本**

扩展：

```ts
export type EvidenceWorkspaceData = {
  // Existing fields remain unchanged.
  reports: PublishableReport[];
};
```

`ManagedWorkspaceQueryAdapter` 增加：

```ts
listReports: (input: { projectId: string }) => Promise<ReportRow[]>;
```

只有 ready 状态与其他完整快照并行读取 reports；queued、running、failed 继续提前返回。

- [x] **步骤 5：验证 GREEN**

运行：

```bash
npm run test:unit -- tests/unit/report-store.test.ts tests/unit/managed-workspace-store.test.ts tests/unit/evidence-workspace.test.ts
```

预期：目标测试全部通过，无 Provider 网络调用。

- [x] **步骤 6：提交 Store 和 fixtures**

```bash
git add src/features/reports src/features/research/evidence-workspace.ts src/features/research/evidence-workspace-fixture.ts src/features/research/managed-workspace-store.ts tests/unit/report-store.test.ts tests/unit/managed-workspace-store.test.ts
git commit -m "feat(reports): 建立报告版本读取边界"
```

### 任务 3：发布和撤销 Server Actions

**文件：**

- 创建：`src/features/reports/actions.ts`
- 创建：`tests/unit/report-actions.test.ts`

- [x] **步骤 1：编写 Action RED 测试**

生产入口外保留可注入核心：

```ts
const result = await publishManagedReport(
  { locale: "zh", projectId: "project_1", reportId: "report_v2" },
  {
    requireUser: async () => ({ id: "owner_1" }),
    createStore: () => store,
    revalidate: vi.fn(),
  },
);

expect(store.publish).toHaveBeenCalledWith({
  ownerId: "owner_1",
  projectId: "project_1",
  reportId: "report_v2",
});
expect(result).toEqual({
  ok: true,
  slug: "research-project-1",
  version: 2,
  publishedAt: "2026-07-17T10:00:00.000Z",
});
```

测试输入拒绝、认证发生在写入前、发布成功 revalidate `/${locale}/app/research/${projectId}` 和 `/r/${slug}`、撤销成功 revalidate 相同路径、失败时不返回数据库详情。

- [x] **步骤 2：运行测试确认 RED**

```bash
npm run test:unit -- tests/unit/report-actions.test.ts
```

预期：Action helper 不存在。

- [x] **步骤 3：实现最小 Server Actions**

```ts
"use server";

export async function publishReport(
  locale: AppLocale,
  projectId: string,
  reportId: string,
) {
  return publishManagedReport(
    { locale, projectId, reportId },
    createProductionDependencies(),
  );
}

export async function revokeReport(locale: AppLocale, projectId: string) {
  return revokeManagedReport(
    { locale, projectId },
    createProductionDependencies(),
  );
}
```

参数 Schema 只允许 `zh/en` 和非空 ID。依赖工厂在服务器端创建 Supabase Server Client 和 Report Store。调用 `revalidatePath` 前使用 Store 返回的可信 slug。

- [x] **步骤 4：验证 GREEN**

```bash
npm run test:unit -- tests/unit/report-actions.test.ts
```

预期：Action 测试全部通过。

- [x] **步骤 5：提交 Actions**

```bash
git add src/features/reports/actions.ts tests/unit/report-actions.test.ts
git commit -m "feat(reports): 增加报告发布服务动作"
```

### 任务 4：工作台报告视图和发布控制

**文件：**

- 创建：`src/components/evidence-workspace/workspace-report.tsx`
- 修改：`src/components/evidence-workspace/evidence-workspace.tsx`
- 修改：`src/components/evidence-workspace/evidence-workspace.module.css`
- 修改：`messages/zh.json`
- 修改：`messages/en.json`
- 修改：`tests/unit/evidence-workspace-ui.test.tsx`
- 修改：`tests/e2e/evidence-workspace.spec.ts`
- 修改：`tests/e2e/evidence-workspace-visual.spec.ts`

- [x] **步骤 1：编写报告视图 RED 组件测试**

扩展 action mocks：

```ts
const reportActionMocks = vi.hoisted(() => ({
  publishReport: vi.fn(async () => ({
    ok: true as const,
    slug: "traceable-citations-review-zh",
    version: 1,
    publishedAt: "2026-07-17T10:00:00.000Z",
  })),
  revokeReport: vi.fn(async () => ({ ok: true as const })),
}));
```

断言：

```ts
await user.click(screen.getByRole("tab", { name: "报告" }));
expect(screen.getByRole("heading", { name: workspace.reports[0].sections[0].heading })).toBeVisible();

await user.selectOptions(screen.getByLabelText("报告版本"), "report_v1");
await user.click(screen.getByRole("button", { name: "发布此版本" }));
expect(reportActionMocks.publishReport).toHaveBeenCalledWith(
  "zh",
  workspace.project.id,
  "report_v1",
);
```

补充测试：published 版本显示撤销和复制链接；失败时保留旧状态并显示 alert；点击 Citation 同步 Claim 和 Source；Demo 不调用写 Action。

- [x] **步骤 2：运行组件测试确认 RED**

```bash
npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx
```

预期：报告 Tab 和操作控件不存在。

- [x] **步骤 3：实现报告组件和状态更新**

`WorkspaceReport` 接收：

```ts
type WorkspaceReportProps = {
  locale: AppLocale;
  projectId: string;
  reports: PublishableReport[];
  persistence: "demo" | "managed";
  onSelectCitation: (citation: ReportCitation) => void;
};
```

使用 `useTransition` 执行发布/撤销，只有成功返回后更新本地 reports。图谱和报告使用可键盘操作的 `role="tablist"`，报告正文从结构化 sections 渲染，Citation 按钮带精确来源标题。

发布按钮使用 `Upload`，撤销使用 `EyeOff`，打开公开页使用 `ExternalLink`，复制使用 `Copy`；图标按钮提供 `title` 和可访问名称。

- [x] **步骤 4：添加双语文案和稳定 CSS**

新增 `Workspace.report` 命名空间，覆盖 graph/report tab、版本、draft/published/revoked、发布、切换、撤销、分享、复制成功/失败和错误状态。

中栏固定原有 grid track 和最小高度；报告正文只在面板内部滚动。移动端 Graph 一级面板内显示 graph/report 二级 Tab，不新增第五个一级 Tab。

- [x] **步骤 5：验证 GREEN 和工作台 E2E**

```bash
npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx
npx playwright test tests/e2e/evidence-workspace.spec.ts tests/e2e/evidence-workspace-visual.spec.ts
```

预期：报告交互通过；现有图谱 canvas 像素和三尺寸稳定性继续通过。

- [x] **步骤 6：提交工作台报告视图**

```bash
git add src/components/evidence-workspace messages tests/unit/evidence-workspace-ui.test.tsx tests/e2e/evidence-workspace.spec.ts tests/e2e/evidence-workspace-visual.spec.ts
git commit -m "feat(workspace): 增加报告版本与发布控制"
```

### 任务 5：匿名公开报告页、SEO 和打印

**文件：**

- 创建：`src/components/reports/public-report.tsx`
- 创建：`src/components/reports/public-report.module.css`
- 创建：`src/app/r/[slug]/layout.tsx`
- 创建：`src/app/r/[slug]/page.tsx`
- 创建：`src/app/r/[slug]/not-found.tsx`
- 修改：`src/proxy.ts`
- 创建：`tests/e2e/report-publishing.spec.ts`
- 创建：`tests/e2e/public-report-visual.spec.ts`

- [x] **步骤 1：编写公开路由 RED E2E**

```ts
test("opens a frozen public report without a locale redirect", async ({ page }) => {
  await page.goto("/r/traceable-citations-review-zh");

  await expect(page).toHaveURL(/\/r\/traceable-citations-review-zh$/);
  await expect(page.getByRole("heading", { name: "可追溯引用是否让 AI 研究更容易审核？" })).toBeVisible();
  await expect(page.getByRole("link", { name: /打开原始来源/ }).first()).toHaveAttribute(
    "href",
    /^https:\/\//,
  );
});

test("returns 404 for an unavailable report", async ({ request }) => {
  expect((await request.get("/r/missing-report")).status()).toBe(404);
});
```

视觉测试遍历 390x844、1024x768、1440x1000，断言无横向溢出、正文和引用不重叠；`page.emulateMedia({ media: "print" })` 后分享工具隐藏、正文仍可见。

- [x] **步骤 2：运行 E2E 确认 RED**

```bash
npx playwright test tests/e2e/report-publishing.spec.ts tests/e2e/public-report-visual.spec.ts
```

预期：`/r/[slug]` 被 locale middleware 重定向或返回 404，因为路由尚不存在。

- [x] **步骤 3：放行非 locale 公开报告路由**

在 `src/proxy.ts` 的 locale middleware 前增加：

```ts
if (/^\/r\/[^/]+$/.test(request.nextUrl.pathname)) {
  return NextResponse.next();
}
```

保持 API、Auth 和安全 Header 配置不变。

- [x] **步骤 4：实现独立 root layout、页面和 metadata**

`layout.tsx` 导入全局 CSS，并用 cached public loader 的语言设置 `<html lang>`。`page.tsx` 与 `generateMetadata` 读取同一个报告；空结果调用 `notFound()`。

Metadata 最低字段：

```ts
return {
  title: report.title,
  description: report.question,
  alternates: { canonical: `/r/${slug}` },
  openGraph: {
    type: "article",
    url: `/r/${slug}`,
    title: report.title,
    description: report.question,
    publishedTime: report.report.publishedAt,
  },
};
```

- [x] **步骤 5：实现安全的结构化报告渲染**

`PublicReport` 不使用 `dangerouslySetInnerHTML`。章节 markdown 按空行拆成段落，Citation marker `/\[([^\]]+)\]/g` 映射到页内引用链接；无法解析的 marker 保持普通文本。

引用区使用 `<ol>`，显示 quote、来源标题和带 `target="_blank" rel="noreferrer"` 的原始来源链接。页面工具仅保留复制链接和打印按钮，不展示登录用户操作。

- [x] **步骤 6：验证 GREEN、metadata 和打印**

```bash
npx playwright test tests/e2e/report-publishing.spec.ts tests/e2e/public-report-visual.spec.ts tests/e2e/public-routes.spec.ts
npm run typecheck
npm run build
```

预期：公开报告保持 `/r/` URL，双语 fixture、404、SEO、三尺寸和 print 检查通过，生产构建成功。

- [x] **步骤 7：提交公开报告页**

```bash
git add src/app/r src/components/reports src/proxy.ts tests/e2e/report-publishing.spec.ts tests/e2e/public-report-visual.spec.ts
git commit -m "feat(reports): 增加只读公开报告页"
```

### 任务 6：模块门禁和状态收口

**文件：**

- 修改：`PROJECT_STATUS.md`
- 修改：`docs/development-plan.md`
- 修改：`docs/superpowers/plans/2026-07-17-report-publishing-plan.md`

- [x] **步骤 1：运行聚焦 Provider 和泄密扫描**

```bash
npm run check:provider-boundary
git grep -n -E '(sk-[A-Za-z0-9_-]{16,}|DASHSCOPE_API_KEY=.+|SUPABASE_SERVICE_ROLE_KEY=.+)' -- . ':!package-lock.json'
```

预期：Provider boundary 通过，Git grep 无凭据命中。

- [x] **步骤 2：运行完整模块门禁**

```bash
npm run test:managed
```

预期：数据库测试、Schema lint、lint、typecheck、全部单元测试、生产构建和全部 E2E 通过；真实 Provider 保持禁用。

- [x] **步骤 3：检查三尺寸截图**

查看：

```text
output/playwright/evidence-workspace-mobile.png
output/playwright/evidence-workspace-tablet.png
output/playwright/evidence-workspace-desktop.png
output/playwright/public-report-mobile.png
output/playwright/public-report-tablet.png
output/playwright/public-report-desktop.png
```

确认无横向溢出、文字裁切、控件重叠、异常空白和报告/图谱切换引起的布局位移。

- [x] **步骤 4：更新状态和计划勾选**

`PROJECT_STATUS.md` 记录本地分支、数据库测试数量、单元/E2E 数量、完整门禁结果和“不 push、不创建堆叠 PR”。`docs/development-plan.md` 将报告发布标为本地完成，继续等待父分支按顺序闭环。

- [x] **步骤 5：提交模块验证**

```bash
git add PROJECT_STATUS.md docs/development-plan.md docs/superpowers/plans/2026-07-17-report-publishing-plan.md
git diff --staged --check
git commit -m "docs(status): 记录报告发布验证"
```

- [x] **步骤 6：确认本地分支状态**

```bash
git status --short --branch
git log --oneline --decorate feat/durable-research-results..HEAD
```

预期：工作树干净；报告发布提交只存在本地；未 push、未创建 PR。

### 任务 7：对齐父模块并闭环唯一 Draft PR

- [x] **步骤 1：以 merge commit 对齐最新 `main` 并解决状态文档冲突**
- [x] **步骤 2：重新运行 `npm run test:managed`，通过 89 个数据库测试、170 个单元测试和 45 个 E2E**
- [x] **步骤 3：复查工作台报告和公开报告三档截图**
- [x] **步骤 4：检查差异、推送分支并创建唯一 Draft PR**
- [ ] **步骤 5：执行独立 Claude 审核、CI 和 merge commit 闭环**
