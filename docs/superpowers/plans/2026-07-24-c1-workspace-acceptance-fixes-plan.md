# C1 Workspace Acceptance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authentication, account identity, project/report navigation, research progress, form focus, wrapping, and back navigation clear enough to complete C1 local acceptance.

**Architecture:** Keep the public Evidence Graph overview separate from authenticated workspace routes. Add a reusable managed-app shell fed by a minimal authenticated user DTO, add an owner-scoped report-list store and route without schema changes, then make local interaction fixes inside the existing auth, project, and workspace components.

**Tech Stack:** Next.js 16.2 App Router, React 19 server actions, next-intl, Supabase Auth/PostgREST/RLS, Vitest, Testing Library, Playwright.

---

## File Structure

- `src/features/auth/session.ts`: map Supabase-compatible user data to the minimum account DTO.
- `src/components/auth/github-sign-in-button.tsx`: show OAuth form submission feedback.
- `src/components/projects/managed-app-shell.tsx`: render authenticated project/report navigation, account identity, and sign-out.
- `src/components/projects/managed-app-shell.module.css`: responsive managed header styles.
- `src/features/reports/report-list-store.ts`: query and map owner-scoped report summaries.
- `src/components/reports/report-dashboard.tsx`: render report rows and empty state.
- `src/components/reports/report-dashboard.module.css`: report list layout.
- `src/app/[locale]/app/reports/page.tsx`: protected report-list route.
- Existing app pages: wrap managed content and add return links.
- Existing auth/project/workspace CSS and messages: pending, loading, focus, wrapping, and bilingual copy.

### Task 1: OAuth feedback and minimum account identity

**Files:**
- Create: `src/components/auth/github-sign-in-button.tsx`
- Modify: `src/app/[locale]/auth/login/page.tsx`
- Modify: `src/app/[locale]/auth/login/login.module.css`
- Modify: `src/features/auth/session.ts`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Test: `tests/unit/auth-session.test.ts`
- Test: `tests/unit/github-sign-in-button.test.tsx`

- [ ] **Step 1: Write failing account-summary tests**

Add assertions that `requireUser` prefers GitHub `user_name`, falls back to email, and never returns the complete metadata object:

```ts
expect(await requireUser({
  locale: "zh",
  getUser: async () => ({
    id: "user_1",
    email: "user@example.com",
    user_metadata: { user_name: "ailian", private_value: "hidden" },
  }),
  redirectTo: unexpectedRedirect,
})).toEqual({
  id: "user_1",
  email: "user@example.com",
  displayName: "ailian",
});
```

- [ ] **Step 2: Write a failing OAuth button test**

Mock `react-dom` `useFormStatus()` as pending and assert the button is disabled and reads `正在前往 GitHub...` with an icon marked by `data-loading-indicator="true"`.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm run test:unit -- tests/unit/auth-session.test.ts tests/unit/github-sign-in-button.test.tsx
```

Expected: FAIL because account metadata mapping and the pending button do not exist.

- [ ] **Step 4: Implement the minimum DTO and submit button**

Use a narrow return shape:

```ts
const readDisplayName = (user: AuthenticatedUser) => {
  const metadata = user.user_metadata;
  const candidates = [metadata?.user_name, metadata?.preferred_username, metadata?.full_name];
  return candidates.find((value): value is string => typeof value === "string" && value.trim())
    ?.trim() ?? user.email?.trim() ?? null;
};
```

The client button uses `useFormStatus`, `LoaderCircle`, and translated idle/pending labels. The login page continues to submit the existing server action and does not implement a popup.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run test:unit -- tests/unit/auth-session.test.ts tests/unit/github-sign-in-button.test.tsx tests/unit/hosted-development-auth.test.ts
git add src/features/auth/session.ts src/components/auth src/app/[locale]/auth/login messages tests/unit
git commit -m "fix(auth): 补充登录反馈与账号摘要"
```

### Task 2: Managed workspace shell and unambiguous public navigation

**Files:**
- Create: `src/components/projects/managed-app-shell.tsx`
- Create: `src/components/projects/managed-app-shell.module.css`
- Modify: `src/app/[locale]/app/page.tsx`
- Modify: `src/app/[locale]/app/research/new/page.tsx`
- Modify: `src/app/[locale]/app/research/[id]/page.tsx`
- Modify: `src/components/site/site-header.tsx`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Test: `tests/unit/project-workspace-ui.test.tsx`
- Test: `tests/unit/managed-workspace-page.test.tsx`
- Test: `tests/unit/site-header.test.tsx`

- [ ] **Step 1: Write failing shell and navigation tests**

Render the shell with `{ displayName: "ailian", email: "user@example.com" }` and assert:

```ts
expect(screen.getByRole("navigation", { name: "工作台导航" })).toBeVisible();
expect(screen.getByRole("link", { name: "研究项目" })).toHaveAttribute("href", "/zh/app");
expect(screen.getByRole("link", { name: "研究报告" })).toHaveAttribute("href", "/zh/app/reports");
expect(screen.getByText("ailian")).toBeVisible();
expect(screen.getByRole("button", { name: "退出登录" })).toBeVisible();
```

Update public-header expectations to `产品介绍` and `进入工作台`. Update managed-page mocks to return `email` and `displayName` and assert the page passes that DTO to the shell.

- [ ] **Step 2: Verify RED**

```bash
npm run test:unit -- tests/unit/project-workspace-ui.test.tsx tests/unit/managed-workspace-page.test.tsx tests/unit/site-header.test.tsx
```

Expected: FAIL because the shell and revised copy do not exist.

- [ ] **Step 3: Implement the shell and page wrappers**

The shell accepts only:

```ts
type ManagedAppShellProps = {
  active: "projects" | "reports";
  children: React.ReactNode;
  locale: AppLocale;
  user: { displayName: string | null; email: string | null };
};
```

It binds `signOut(locale)`, renders localized project/report links, uses `aria-current`, and keeps account text wrapping within the header. Real project pages wrap their existing content; the public `demo` branch remains unchanged.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npm run test:unit -- tests/unit/project-workspace-ui.test.tsx tests/unit/managed-workspace-page.test.tsx tests/unit/site-header.test.tsx tests/unit/auth-session.test.ts
git add src/components/projects src/components/site src/app/[locale]/app messages tests/unit
git commit -m "feat(workspace): 明确工作台导航与账号信息"
```

### Task 3: Owner-scoped report list

**Files:**
- Create: `src/features/reports/report-list-store.ts`
- Create: `src/components/reports/report-dashboard.tsx`
- Create: `src/components/reports/report-dashboard.module.css`
- Create: `src/app/[locale]/app/reports/page.tsx`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Test: `tests/unit/report-list-store.test.ts`
- Test: `tests/unit/report-dashboard.test.tsx`
- Test: `tests/unit/report-list-page.test.tsx`
- Modify: `tests/e2e/project-dashboard.spec.ts`

- [ ] **Step 1: Write failing store tests**

Define rows containing report fields plus a joined `projects` object. Assert the mapped DTO contains only list fields, normalizes timestamps, preserves query order, and calls the adapter with `ownerId`:

```ts
await expect(store.list({ ownerId: "owner_1" })).resolves.toEqual([
  expect.objectContaining({
    id: "report_2",
    projectId: "project_1",
    projectTitle: "Traceable research",
    version: 2,
    status: "published",
    slug: "research-project-1",
  }),
]);
```

The Supabase adapter must use an inner project join, `.eq("projects.owner_id", ownerId)`, `.neq("projects.status", "deleted")`, and descending `created_at` order. Unknown database details map to `REPORT_LIST_QUERY_FAILED`.

- [ ] **Step 2: Write failing UI and page tests**

Assert the dashboard renders report status, version, research link, and public link only for published rows with a slug. Assert the page requires the user with `nextPath: "/zh/app/reports"`, queries by that user id, and selects the report shell tab.

- [ ] **Step 3: Verify RED**

```bash
npm run test:unit -- tests/unit/report-list-store.test.ts tests/unit/report-dashboard.test.tsx tests/unit/report-list-page.test.tsx
```

Expected: FAIL because the report list modules and route do not exist.

- [ ] **Step 4: Implement the report list**

Use this DTO boundary:

```ts
type ManagedReportSummary = {
  id: string;
  projectId: string;
  projectTitle: string;
  question: string;
  language: AppLocale;
  version: number;
  status: "draft" | "published" | "revoked";
  slug?: string;
  publishedAt?: string;
  createdAt: string;
};
```

The protected page composes `requireManagedUser`, the Supabase adapter/store, `ManagedAppShell active="reports"`, and `ReportDashboard`. No migration or provider call is added.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run test:unit -- tests/unit/report-list-store.test.ts tests/unit/report-dashboard.test.tsx tests/unit/report-list-page.test.tsx tests/unit/report-store.test.ts
git add src/features/reports src/components/reports src/app/[locale]/app/reports messages tests/unit tests/e2e/project-dashboard.spec.ts
git commit -m "feat(reports): 增加研究报告列表"
```

### Task 4: Research progress, form focus/wrapping, and return navigation

**Files:**
- Modify: `src/components/evidence-workspace/managed-workspace-state.tsx`
- Modify: `src/components/evidence-workspace/evidence-workspace.tsx`
- Modify: `src/components/evidence-workspace/evidence-workspace.module.css`
- Modify: `src/components/projects/new-research-form.tsx`
- Modify: `src/components/projects/project-workspace.module.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Test: `tests/unit/evidence-workspace-ui.test.tsx`
- Test: `tests/unit/project-workspace-ui.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Assert queued/running state contains `data-loading-indicator="true"` and a `返回项目列表` link; assert ready workspace and the new-research header expose the same return link. Mock `useActionState` pending state and assert the create button contains the loading marker and pending label.

- [ ] **Step 2: Write failing CSS contract tests**

Read both CSS modules and assert:

```ts
expect(workspaceCss).toMatch(/data-workspace-state="queued"[\s\S]*workspace-spin/);
expect(workspaceCss).toContain("prefers-reduced-motion: reduce");
expect(projectCss).not.toMatch(/:focus[\s\S]*border-color:[\s\S]*outline: 1px solid/);
expect(projectCss).toMatch(/\.urlHeader[\s\S]*flex-wrap: wrap/);
expect(projectCss).toMatch(/\.secondaryButton[\s\S]*white-space: normal/);
```

- [ ] **Step 3: Verify RED**

```bash
npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx tests/unit/project-workspace-ui.test.tsx
```

Expected: FAIL on missing loading markers, top-level return links, and CSS contracts.

- [ ] **Step 4: Implement the minimum interaction fixes**

Use `LoaderCircle` for pending creation, add page-level `ArrowLeft` links, animate managed `queued/running` icons with the existing keyframes, disable animation for reduced motion, use one visible focus boundary, and allow the source header/button to wrap without changing field limits.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx tests/unit/project-workspace-ui.test.tsx tests/unit/managed-workspace-page.test.tsx
git add src/components/evidence-workspace src/components/projects messages tests/unit
git commit -m "fix(ui): 完善研究进度与页面返回"
```

### Task 5: Full C1 verification and status update

**Files:**
- Modify: `PROJECT_STATUS.md`

- [ ] **Step 1: Run static and focused route gates**

```bash
git diff --check
npm run lint
npm run typecheck
npm run test:unit
```

Expected: all PASS with provider mode remaining fixture.

- [ ] **Step 2: Run the full module gate**

```bash
npm run test:managed
```

Expected: hosted pgTAP, lint, typecheck, unit, production build, and E2E all PASS; no paid provider calls.

- [ ] **Step 3: Perform visual verification**

Use local Playwright only for UI screenshots at 390x844, 1024x768, and 1440x1000. Check login, project list, report list, new research, pending run, and ready workspace for overflow, clipping, overlap, and stable navigation. Do not treat Playwright as user OAuth acceptance.

- [ ] **Step 4: Update status and commit**

Record the new implementation head, verification, and remaining user OAuth/UI acceptance while keeping PR #18 Draft/Open and Production frozen.

```bash
git add PROJECT_STATUS.md
git commit -m "docs(status): 记录工作台验收修复"
git push origin feat/c1-local-live-research
```
