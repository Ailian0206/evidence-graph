# Workspace Review Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguish research projects from the report library, move claim review actions into the selected claim, and replace the `A/` site mark with `A`.

**Architecture:** Preserve existing routes, storage contracts, and Server Actions. Make report grouping a presentation concern, pass a validated initial workspace mode from the managed page, and keep review persistence in `EvidenceWorkspace` while `WorkspaceClaimList` renders the selected claim controls.

**Tech Stack:** Next.js 16.2 App Router, React 19, next-intl, TypeScript, CSS Modules, Vitest, Testing Library, Playwright.

---

## File Structure

- `src/components/reports/report-dashboard.tsx`: group report versions by project and render report-centric actions.
- `src/components/reports/report-dashboard.module.css`: group and version-row layout.
- `src/app/[locale]/app/research/[id]/page.tsx`: validate `searchParams.view` and pass the initial report mode.
- `src/components/evidence-workspace/evidence-workspace.tsx`: own review transitions, automatic selection, undo, rollback, and initial mode.
- `src/components/evidence-workspace/workspace-claim-list.tsx`: render semantic claim rows and inline review controls.
- `src/components/evidence-workspace/evidence-workspace.module.css`: selected-card review layout and responsive behavior.
- `src/features/research/evidence-workspace.ts`: pure next-pending selection helper.
- `src/components/site/site-header.tsx`: render the simplified site mark.
- `messages/zh.json`, `messages/en.json`: bilingual report-library and review feedback copy.
- Existing unit and E2E files: lock behavior and responsive contracts without changing Provider boundaries.

### Task 1: Report library responsibilities and report deep links

**Files:**
- Modify: `tests/unit/report-dashboard.test.tsx`
- Modify: `tests/unit/managed-app-shell.test.tsx`
- Modify: `tests/unit/managed-workspace-page.test.tsx`
- Modify: `src/components/reports/report-dashboard.tsx`
- Modify: `src/components/reports/report-dashboard.module.css`
- Modify: `src/components/projects/managed-app-shell.tsx`
- Modify: `src/app/[locale]/app/research/[id]/page.tsx`
- Modify: `src/components/evidence-workspace/evidence-workspace.tsx`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Write failing report-library tests**

Assert that navigation and page title use “报告库”, the page has no “新建研究” link, versions of one project share one project group in descending version order, and every private version links to `/app/research/{projectId}?view=report`. Assert the empty state links back to `/app`.

- [ ] **Step 2: Write a failing managed-page test**

Call the page with `searchParams: Promise.resolve({ view: "report" })`, return a ready workspace from the store mock, and assert the rendered `EvidenceWorkspace` element receives `initialMode="report"`. Add an invalid-value assertion for the `graph` fallback.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm run test:unit -- tests/unit/report-dashboard.test.tsx tests/unit/managed-app-shell.test.tsx tests/unit/managed-workspace-page.test.tsx
```

Expected: failures for the old “研究报告” label, new-research CTA, flat report rows, missing `view=report`, and missing `initialMode`.

- [ ] **Step 4: Implement the minimum report grouping and initial mode**

Use a `Map<string, ReportProjectGroup>` keyed by `projectId`; sort groups by newest report timestamp and versions by version then timestamp descending. The managed page awaits optional `searchParams`, accepts only `view === "report"`, preserves the query in the auth return path, and passes `initialMode` to `EvidenceWorkspace`. When the mode is `report`, initialize the mobile tab to `graph` so the report panel is visible.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run test:unit -- tests/unit/report-dashboard.test.tsx tests/unit/managed-app-shell.test.tsx tests/unit/managed-workspace-page.test.tsx tests/unit/report-list-page.test.tsx tests/unit/report-list-store.test.ts
git add src/app/[locale]/app/research/[id]/page.tsx src/components/reports src/components/projects/managed-app-shell.tsx src/components/evidence-workspace/evidence-workspace.tsx messages tests/unit
git commit -m "feat(reports): 明确报告库与项目职责"
```

### Task 2: Inline claim review with automatic advance and rollback

**Files:**
- Modify: `tests/unit/evidence-workspace.test.ts`
- Modify: `tests/unit/evidence-workspace-ui.test.tsx`
- Modify: `src/features/research/evidence-workspace.ts`
- Modify: `src/components/evidence-workspace/evidence-workspace.tsx`
- Modify: `src/components/evidence-workspace/workspace-claim-list.tsx`
- Modify: `src/components/evidence-workspace/evidence-workspace.module.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Write a failing pure-selection test**

Add `findNextPendingClaimId` expectations for the next pending claim, end-to-start wrapping, exclusion of the current claim when it is the only pending item, and the first eligible pending claim when the current ID is absent.

- [ ] **Step 2: Verify helper RED and implement GREEN**

Run `npm run test:unit -- tests/unit/evidence-workspace.test.ts`; expect a missing-export failure. Implement a pure helper that receives ordered claim summaries plus `currentClaimId`, iterates at most once through the array, and returns a pending claim ID or `undefined`. Re-run the test to GREEN.

- [ ] **Step 3: Write failing inline-interaction tests**

Assert that only the selected claim card contains review actions, the old `selected-claim` bottom dock is absent, accepting the first pending claim selects the second pending claim, rejecting the last pending claim wraps to the first, all-reviewed state stays on the reviewed claim, and accepted/rejected cards expose “恢复待审核”. Use fake timers to assert the 6-second undo notice disappears.

- [ ] **Step 4: Write a failing managed rollback test**

Reject a pending managed claim with `reviewClaim` mocked to reject. Assert optimistic auto-advance occurs first, then the failed claim is restored to pending, reselected, and displays its own alert with retry controls.

- [ ] **Step 5: Verify UI RED**

Run:

```bash
npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx
```

Expected: failures because actions remain in the list footer, selection does not advance, and undo feedback does not exist.

- [ ] **Step 6: Implement the minimum inline review flow**

Replace the all-in-one claim button with an `<article>` containing a summary selection button and selected-only review section. Change `handleReview` to accept a claim ID, optimistically update, select the next eligible pending claim, and persist through the existing action. Track one undo record for 6000ms; undo writes `pending`. On failure, restore the prior status, clear the undo record, select the failed claim, and show its alert. Reconcile `selectedClaimId` whenever filters remove the selected row and scroll the next selected row with `block: "nearest"`.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm run test:unit -- tests/unit/evidence-workspace.test.ts tests/unit/evidence-workspace-ui.test.tsx
git add src/features/research/evidence-workspace.ts src/components/evidence-workspace messages tests/unit/evidence-workspace.test.ts tests/unit/evidence-workspace-ui.test.tsx
git commit -m "feat(workspace): 支持主张就地连续审核"
```

### Task 3: Simplify the Ailian brand mark

**Files:**
- Modify: `tests/unit/site-header.test.tsx`
- Modify: `src/components/site/site-header.tsx`

- [ ] **Step 1: Write and verify a failing brand test**

Render the site header, scope to the `Ailian home` link, and assert that its mark is exactly `A` and no `A/` text exists. Run `npm run test:unit -- tests/unit/site-header.test.tsx`; expect RED because the current mark is `A/`.

- [ ] **Step 2: Implement, verify, and commit**

Change only the visible mark text to `A`, preserve the link name and CSS class, rerun the focused test, and commit:

```bash
git add src/components/site/site-header.tsx tests/unit/site-header.test.tsx
git commit -m "fix(ui): 简化全站品牌标记"
```

### Task 4: Full verification, browser acceptance, and project status

**Files:**
- Modify: `tests/e2e/evidence-workspace.spec.ts`
- Modify: `tests/e2e/evidence-workspace-visual.spec.ts`
- Modify: `PROJECT_STATUS.md`

- [ ] **Step 1: Add focused E2E contracts if unit coverage cannot observe responsive behavior**

Cover report deep-link activation and selected-claim inline actions through fixture routes only. Do not add real Provider or destructive managed-data calls.

- [ ] **Step 2: Run focused and full automated gates**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
npm run test:managed
```

`test:managed` may use the hosted development database but must not invoke real Providers. If local Docker is unavailable after the Provider boundary phase, record the exact limitation and rely on the existing PR database CI for that phase only.

- [x] **Step 3: Verify real browser layouts**

Use the logged-in local Chrome session for `/zh/app`, `/zh/app/reports`, and a long completed workspace. Check 390x844, 1024x768, and 1440x1000 for no horizontal overflow, clipping, overlap, or controls detached from the selected claim. Verify report links open the report view and the mark reads `A`.

- [x] **Step 4: Update status, commit, push, and update Draft PR #18**

Record the new acceptance fixes, test counts, browser verification, asynchronous user feedback status, and unchanged Production freeze in `PROJECT_STATUS.md`. Commit as `docs(status): 记录工作台交互修复`, push `feat/c1-local-live-research`, and confirm GitHub CI for the pushed head. Do not run paid Providers or deployment; after the verified push, proceed directly to independent Claude review and merge according to `AGENT.md`.
