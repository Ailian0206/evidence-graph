# C2 Core Research Loop Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four frozen C2 P1 defects so every Claim is reviewable, failed research creation preserves input, project lifecycle copy is accurate, and every newly published report is an immutable snapshot derived only from reviewed accepted Claims.

**Architecture:** Keep Claim review state in the existing workspace client state, but decouple the Claim list from Evidence relation filters. Add a pure deterministic report-review module that computes readiness and derives a filtered snapshot; the authenticated Server Action uses owner-scoped report and Claim reads, then a new PostgreSQL RPC revalidates review state and atomically creates and publishes the next immutable version. Keep Provider calls out of the entire flow.

**Tech Stack:** Next.js 16.2.10 App Router and Server Actions, React 19, TypeScript, next-intl, Zod, Supabase/PostgreSQL PL/pgSQL, Vitest/Testing Library, pgTAP, Playwright.

---

## File Map

- `src/features/research/evidence-workspace.ts`: Claim summaries, human-review filtering, and next-pending selection.
- `src/components/evidence-workspace/evidence-workspace.tsx`: Workspace state coordination, Claim selection, report readiness navigation, and mobile tab changes.
- `src/components/evidence-workspace/workspace-report.tsx`: Report readiness status, publish/revoke controls, immutable version insertion, and stable error presentation.
- `src/features/reports/reviewed-report.ts`: New pure readiness and deterministic reviewed-snapshot derivation module.
- `src/features/reports/report-store.ts`: Owner-first report/Claim reads, new reviewed-report RPC adapter, and complete published report DTO mapping.
- `src/features/reports/actions.ts`: Stable reviewed-publication action result and error mapping.
- `src/components/projects/new-research-form.tsx`: Controlled draft values for title, question, language, and manual URLs.
- `messages/zh.json`, `messages/en.json`: Bilingual C2 copy, including project lifecycle and report readiness/errors.
- `supabase/migrations/20260728000100_reviewed_report_publishing.sql`: Replace direct version publication with atomic reviewed snapshot creation/publication.
- `supabase/tests/04_report_publishing.sql`: pgTAP coverage for review gates, ownership, immutability, versioning, audit, public reads, and revoke.
- `tests/unit/evidence-workspace.test.ts`: Claim visibility and pure list-filter behavior.
- `tests/unit/evidence-workspace-ui.test.tsx`: Evidence-less Claim review and report readiness/publish interaction.
- `tests/unit/reviewed-report.test.ts`: Pure reviewed-snapshot derivation cases.
- `tests/unit/report-store.test.ts`: Query order, RPC arguments, stable errors, and full returned report.
- `tests/unit/report-actions.test.ts`: Owner-first action flow, result DTO, revalidation, and error codes.
- `tests/unit/project-workspace-ui.test.tsx`: Controlled form recovery and lifecycle copy.
- `tests/e2e/evidence-workspace.spec.ts`: Fixture workspace Claim visibility, readiness navigation, and report behavior.
- `tests/e2e/evidence-workspace-visual.spec.ts`: 390x844, 1024x768, and 1440x1000 layout checks for Claim and report states.
- `PROJECT_STATUS.md`, `docs/roadmap.md`, `docs/development-plan.md`: C2 verification, PR, review, CI, and milestone state.

### Task 1: Make Every Claim Visible and Correct the Project Lifecycle Label

**Files:**
- Modify: `src/features/research/evidence-workspace.ts:90-110`
- Modify: `src/components/evidence-workspace/evidence-workspace.tsx:101-126`
- Modify: `messages/zh.json`
- Test: `tests/unit/evidence-workspace.test.ts:28-60`
- Test: `tests/unit/evidence-workspace-ui.test.tsx:285-295`
- Test: `tests/unit/project-workspace-ui.test.tsx:63-99`

- [ ] **Step 1: Write the failing pure Claim-filter tests**

Replace the relation-coupled expectation with tests that add an Evidence-less Claim and prove only `reviewStatus` controls the list:

```ts
it("keeps evidence-less claims visible and filters only by review status", () => {
  const workspace = createEvidenceWorkspaceFixture("zh");
  const evidenceLessClaim = {
    ...workspace.claims[0],
    id: "claim_without_evidence",
    normalizedKey: "claim without evidence",
    statement: "没有证据关系的主张仍需人工审核。",
    reviewStatus: "pending" as const,
  };
  const summaries = createWorkspaceClaimSummaries({
    ...workspace,
    claims: [...workspace.claims, evidenceLessClaim],
  });

  expect(filterWorkspaceClaims({ claims: summaries, reviewStatus: "all" })).toHaveLength(
    workspace.claims.length + 1,
  );
  expect(
    filterWorkspaceClaims({ claims: summaries, reviewStatus: "pending" }),
  ).toContainEqual(
    expect.objectContaining({
      claim: expect.objectContaining({ id: "claim_without_evidence" }),
      evidenceLinks: [],
    }),
  );
});
```

- [ ] **Step 2: Run the pure Claim-filter test and verify RED**

Run: `npm run test:unit -- tests/unit/evidence-workspace.test.ts`

Expected: FAIL because `filterWorkspaceClaims` still requires `relations` and removes Claims without a matching Evidence Link.

- [ ] **Step 3: Make Claim filtering depend only on human review state**

Change the API and implementation to:

```ts
export const filterWorkspaceClaims = ({
  claims,
  reviewStatus,
}: {
  claims: WorkspaceClaimSummary[];
  reviewStatus: ClaimReviewFilter;
}) =>
  claims.filter(
    ({ claim }) => reviewStatus === "all" || claim.reviewStatus === reviewStatus,
  );
```

Update both `visibleClaims` and `reviewCandidates` in `EvidenceWorkspaceReady` to stop passing Evidence relations. Keep `activeRelations` only in graph construction, Evidence selection, and Source synchronization.

- [ ] **Step 4: Run the pure Claim-filter test and verify GREEN**

Run: `npm run test:unit -- tests/unit/evidence-workspace.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing workspace interaction test**

Replace the old “hides claims” test with:

```tsx
it("keeps claims visible when their evidence relation is disabled", async () => {
  const user = userEvent.setup();
  const workspace = createEvidenceWorkspaceFixture("zh");
  const supportedClaim = workspace.claims[0];
  renderWorkspace();

  await user.click(screen.getByRole("checkbox", { name: "支持" }));

  expect(screen.getByRole("button", { name: supportedClaim.statement })).toBeVisible();
  expect(screen.getByRole("checkbox", { name: "支持" })).not.toBeChecked();
});
```

Add a second test with an Evidence-less pending Claim and assert its card contains `0 条证据` plus the accept/reject controls when selected.

- [ ] **Step 6: Run the workspace interaction test and verify RED**

Run: `npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx`

Expected: FAIL until the component uses the relation-independent filter from Step 3.

- [ ] **Step 7: Make Evidence-less selection stay empty instead of borrowing another source**

Keep `handleSelectClaim` from changing `selectedEvidenceLinkId` when no active Evidence exists. The existing `selectedEvidence`, `selectedChunk`, and `selectedSource` chain must then resolve to `undefined`, allowing `WorkspaceSourceViewer` to show its existing empty state.

- [ ] **Step 8: Run the workspace interaction test and verify GREEN**

Run: `npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx`

Expected: PASS.

- [ ] **Step 9: Change the project lifecycle test to expect “活跃” and verify RED**

Change both Chinese assertions in `project-workspace-ui.test.tsx` from `进行中` to `活跃`, while retaining the separate completed-workspace assertion for `运行完成`.

Run: `npm run test:unit -- tests/unit/project-workspace-ui.test.tsx tests/unit/evidence-workspace-ui.test.tsx`

Expected: FAIL because `Projects.status.active` is still `进行中`.

- [ ] **Step 10: Update bilingual lifecycle copy and verify GREEN**

Set:

```json
"status": {
  "active": "活跃",
  "archived": "已归档",
  "deleted": "已删除"
}
```

Keep English `active` as `Active` and keep `Workspace.run.ready` as `运行完成` / `Run complete`.

Run: `npm run test:unit -- tests/unit/project-workspace-ui.test.tsx tests/unit/evidence-workspace-ui.test.tsx`

Expected: PASS.

- [ ] **Step 11: Commit Task 1**

```bash
git add src/features/research/evidence-workspace.ts src/components/evidence-workspace/evidence-workspace.tsx messages/zh.json messages/en.json tests/unit/evidence-workspace.test.ts tests/unit/evidence-workspace-ui.test.tsx tests/unit/project-workspace-ui.test.tsx
git commit -m "fix(c2): 完善主张审核可见性与项目状态"
```

### Task 2: Preserve the New Research Draft After Server Action Errors

**Files:**
- Modify: `src/components/projects/new-research-form.tsx:18-160`
- Test: `tests/unit/project-workspace-ui.test.tsx:101-169`
- Test: `tests/unit/new-research-form-pending.test.tsx`

- [ ] **Step 1: Write the failing recovery test**

Extend the active-run test to type multiple values, submit, wait for the error, and assert every field remains:

```tsx
it.each([
  "MONTHLY_RUN_LIMIT_EXCEEDED",
  "ACTIVE_RESEARCH_RUN_EXISTS",
  "INVALID_INPUT",
] as const)("preserves the research draft after %s", async (code) => {
  const user = userEvent.setup();
  vi.mocked(createResearch).mockResolvedValueOnce({ status: "error", code } as never);
  renderWithMessages(<NewResearchForm locale="zh" />);

  await user.type(screen.getByRole("textbox", { name: "项目标题" }), "可恢复研究");
  await user.type(
    screen.getByRole("textbox", { name: "研究问题" }),
    "失败后是否保留完整输入？",
  );
  await user.selectOptions(screen.getByRole("combobox", { name: "研究语言" }), "en");
  await user.type(screen.getByRole("textbox", { name: "来源链接 1" }), "https://example.com/a");
  await user.click(screen.getByRole("button", { name: "添加来源链接" }));
  await user.type(screen.getByRole("textbox", { name: "来源链接 2" }), "https://example.com/b");
  await user.click(screen.getByRole("button", { name: "创建研究" }));

  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "项目标题" })).toHaveValue("可恢复研究");
  expect(screen.getByRole("textbox", { name: "研究问题" })).toHaveValue(
    "失败后是否保留完整输入？",
  );
  expect(screen.getByRole("combobox", { name: "研究语言" })).toHaveValue("en");
  expect(screen.getByRole("textbox", { name: "来源链接 1" })).toHaveValue(
    "https://example.com/a",
  );
  expect(screen.getByRole("textbox", { name: "来源链接 2" })).toHaveValue(
    "https://example.com/b",
  );
});
```

- [ ] **Step 2: Run the form test and verify RED**

Run: `npm run test:unit -- tests/unit/project-workspace-ui.test.tsx`

Expected: FAIL because the uncontrolled fields are reset when the Server Action completes with an error.

- [ ] **Step 3: Convert the form to controlled draft state**

Add:

```ts
type ResearchDraft = {
  title: string;
  question: string;
  language: AppLocale;
  manualUrls: Array<{ id: number; value: string }>;
};

const [draft, setDraft] = useState<ResearchDraft>({
  title: "",
  question: "",
  language: locale,
  manualUrls: [{ id: 0, value: "" }],
});
const [nextUrlFieldId, setNextUrlFieldId] = useState(1);
```

Bind every input to `draft`; add URL rows as `{ id, value: "" }`, remove by ID, and update values without changing IDs. Continue submitting the same field names so the existing Server Action and validation remain unchanged. Do not clear draft state in an effect; successful submission still redirects on the server.

- [ ] **Step 4: Run form recovery and pending tests and verify GREEN**

Run: `npm run test:unit -- tests/unit/project-workspace-ui.test.tsx tests/unit/new-research-form-pending.test.tsx tests/unit/create-research-action.test.ts`

Expected: PASS, including the existing disabled button/loading indicator behavior.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/components/projects/new-research-form.tsx tests/unit/project-workspace-ui.test.tsx tests/unit/new-research-form-pending.test.tsx
git commit -m "fix(c2): 保留研究创建失败后的输入"
```

### Task 3: Derive Reviewed Report Snapshots Deterministically

**Files:**
- Create: `src/features/reports/reviewed-report.ts`
- Create: `tests/unit/reviewed-report.test.ts`

- [ ] **Step 1: Write failing readiness tests**

Create tests for referenced Claim status only:

```ts
it("reports pending and rejected referenced claims without counting unrelated claims", () => {
  const readiness = createReportReviewReadiness({
    report,
    claims: [
      claim("claim_accepted", "accepted"),
      claim("claim_pending", "pending"),
      claim("claim_rejected", "rejected"),
      claim("claim_unrelated", "pending"),
    ],
  });

  expect(readiness).toEqual({
    status: "incomplete",
    pendingClaimIds: ["claim_pending"],
    rejectedClaimIds: ["claim_rejected"],
  });
});
```

Also assert a report whose referenced Claims contain no pending returns `status: "ready"` even when an unrelated Claim is pending.

- [ ] **Step 2: Run readiness tests and verify RED**

Run: `npm run test:unit -- tests/unit/reviewed-report.test.ts`

Expected: FAIL because `reviewed-report.ts` does not exist.

- [ ] **Step 3: Implement the minimal readiness API**

Create:

```ts
export type ReportReviewReadiness = {
  status: "incomplete" | "ready";
  pendingClaimIds: string[];
  rejectedClaimIds: string[];
};

export type ReportReviewClaim = Pick<Claim, "id" | "reviewStatus">;

export const createReportReviewReadiness = ({
  report,
  claims,
}: {
  report: PublishableReport;
  claims: ReportReviewClaim[];
}): ReportReviewReadiness => {
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const referencedClaimIds = Array.from(
    new Set(report.citations.map((citation) => citation.claimId)),
  );
  const referencedClaims = referencedClaimIds.map((claimId) => {
    const claim = claimById.get(claimId);
    if (!claim) throw new Error("REPORT_NOT_PUBLISHABLE");
    return claim;
  });
  const pendingClaimIds = referencedClaims
    .filter((claim) => claim.reviewStatus === "pending")
    .map((claim) => claim.id);
  const rejectedClaimIds = referencedClaims
    .filter((claim) => claim.reviewStatus === "rejected")
    .map((claim) => claim.id);

  return {
    status: pendingClaimIds.length > 0 ? "incomplete" : "ready",
    pendingClaimIds,
    rejectedClaimIds,
  };
};
```

- [ ] **Step 4: Run readiness tests and verify GREEN**

Run: `npm run test:unit -- tests/unit/reviewed-report.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing snapshot derivation tests**

Cover all frozen rules with explicit paragraphs:

```ts
it("keeps accepted paragraphs, drops rejected and mixed paragraphs, and preserves uncited context", () => {
  const reviewed = createReviewedReportSnapshot({ report, claims });

  expect(reviewed.sections).toEqual([
    {
      id: "section_findings",
      heading: "Findings",
      factual: true,
      markdown: "Accepted finding [link_accepted]",
      citationIds: ["link_accepted"],
    },
    {
      id: "section_context",
      heading: "Context",
      factual: false,
      markdown: "Method note without a citation.",
      citationIds: [],
    },
  ]);
  expect(reviewed.citations.map((citation) => citation.evidenceLinkId)).toEqual([
    "link_accepted",
  ]);
  expect(reviewed.markdown).toBe(
    "## Findings\n\nAccepted finding [link_accepted]\n\n## Context\n\nMethod note without a citation.",
  );
});
```

Add separate tests that:

- throw `REPORT_REVIEW_INCOMPLETE` before filtering when any referenced Claim is pending;
- drop a paragraph containing both accepted and rejected Citation markers;
- only recognize markers present in that section’s `citationIds`;
- throw `REPORT_NO_ACCEPTED_CONTENT` when filtering leaves no factual paragraph;
- throw `REPORT_NOT_PUBLISHABLE` for a factual paragraph with no recognized Citation or a Citation whose Claim is missing.

- [ ] **Step 6: Run snapshot tests and verify RED**

Run: `npm run test:unit -- tests/unit/reviewed-report.test.ts`

Expected: FAIL because snapshot derivation is not implemented.

- [ ] **Step 7: Implement deterministic paragraph filtering**

Implement the module with these helpers and exports:

```ts
import type { PublishableReport } from "@/features/reports/report-store";
import type { Claim } from "@/features/research/domain";

export type ReviewedReportSnapshot = Pick<
  PublishableReport,
  "markdown" | "sections" | "citations"
>;

const splitParagraphs = (markdown: string) =>
  markdown
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export const createReviewedReportSnapshot = ({
  report,
  claims,
}: {
  report: PublishableReport;
  claims: ReportReviewClaim[];
}): ReviewedReportSnapshot => {
  const readiness = createReportReviewReadiness({ report, claims });
  if (readiness.status === "incomplete") throw new Error("REPORT_REVIEW_INCOMPLETE");
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const citationById = new Map(
    report.citations.map((citation) => [citation.evidenceLinkId, citation]),
  );
  let acceptedFactualParagraphs = 0;
  const sections = report.sections.flatMap((section) => {
    const keptParagraphs = splitParagraphs(section.markdown).flatMap((paragraph) => {
      const citationIds = section.citationIds.filter((citationId) =>
        paragraph.includes(`[${citationId}]`),
      );

      if (citationIds.length === 0) {
        if (section.factual) throw new Error("REPORT_NOT_PUBLISHABLE");
        return [{ markdown: paragraph, citationIds }];
      }

      const paragraphClaims = citationIds.map((citationId) => {
        const citation = citationById.get(citationId);
        const claim = citation ? claimById.get(citation.claimId) : undefined;
        if (!citation || !claim) throw new Error("REPORT_NOT_PUBLISHABLE");
        return claim;
      });

      if (paragraphClaims.some((claim) => claim.reviewStatus === "rejected")) {
        return [];
      }
      if (!paragraphClaims.every((claim) => claim.reviewStatus === "accepted")) {
        throw new Error("REPORT_REVIEW_INCOMPLETE");
      }
      if (section.factual) acceptedFactualParagraphs += 1;
      return [{ markdown: paragraph, citationIds }];
    });

    if (keptParagraphs.length === 0) return [];

    return [
      {
        ...section,
        markdown: keptParagraphs.map((paragraph) => paragraph.markdown).join("\n\n"),
        citationIds: Array.from(
          new Set(keptParagraphs.flatMap((paragraph) => paragraph.citationIds)),
        ),
      },
    ];
  });

  if (acceptedFactualParagraphs === 0) throw new Error("REPORT_NO_ACCEPTED_CONTENT");

  const includedCitationIds = new Set(
    sections.flatMap((section) => section.citationIds),
  );
  const citations = report.citations.filter((citation) =>
    includedCitationIds.has(citation.evidenceLinkId),
  );

  return {
    markdown: sections
      .map((section) => `## ${section.heading}\n\n${section.markdown}`)
      .join("\n\n"),
    sections,
    citations,
  };
};
```

This recognizes only literal markers built as `` `[${citationId}]` `` for IDs declared by the current section, preserves paragraph/section/Citation order, and leaves the original model report unchanged.

- [ ] **Step 8: Run snapshot tests and verify GREEN**

Run: `npm run test:unit -- tests/unit/reviewed-report.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add src/features/reports/reviewed-report.ts tests/unit/reviewed-report.test.ts
git commit -m "feat(c2): 生成确定性的已审核报告快照"
```

### Task 4: Integrate Review Readiness with Store, Server Action, and Workspace UI

**Files:**
- Modify: `src/features/reports/report-store.ts`
- Modify: `src/features/reports/actions.ts`
- Modify: `src/components/evidence-workspace/evidence-workspace.tsx`
- Modify: `src/components/evidence-workspace/workspace-report.tsx`
- Modify: `src/components/evidence-workspace/evidence-workspace.module.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Test: `tests/unit/report-store.test.ts`
- Test: `tests/unit/report-actions.test.ts`
- Test: `tests/unit/evidence-workspace-ui.test.tsx`

- [ ] **Step 1: Write failing Report Store tests for owner-scoped derivation and RPC input**

Define adapter methods and assert order:

```ts
const calls: string[] = [];
const queries = {
  listVersions: vi.fn(async () => {
    calls.push("reports");
    return [draftRow];
  }),
  listClaims: vi.fn(async () => {
    calls.push("claims");
    return acceptedClaimRows;
  }),
  publishReviewed: vi.fn(async (input) => {
    calls.push("publish");
    expect(input).toEqual({
      projectId: "project_1",
      baseReportId: "report_v1",
      markdown: reviewedMarkdown,
      sections: reviewedSections,
      citations: reviewedCitations,
    });
    return [publishedReviewedRow];
  }),
  revoke,
  getPublicReport,
};

await expect(
  createReportStore(queries).publish({
    ownerId: "owner_1",
    projectId: "project_1",
    reportId: "report_v1",
  }),
).resolves.toMatchObject({
  id: publishedReviewedRow.id,
  version: publishedReviewedRow.version,
  status: "published",
});
expect(calls).toEqual(["reports", "claims", "publish"]);
```

Add tests for `REPORT_REVIEW_INCOMPLETE`, `REPORT_NO_ACCEPTED_CONTENT`, missing selected report, and Supabase RPC parameter names.

- [ ] **Step 2: Run Report Store tests and verify RED**

Run: `npm run test:unit -- tests/unit/report-store.test.ts`

Expected: FAIL because the adapter has no Claim read or reviewed-publication RPC.

- [ ] **Step 3: Implement the reviewed Report Store flow**

Add a row type for the selected Claim fields and extend the adapter:

```ts
type ReportClaimRow = {
  id: string;
  project_id: string;
  review_status: "pending" | "accepted" | "rejected";
};

type PublishReviewedReportInput = {
  projectId: string;
  baseReportId: string;
  markdown: string;
  sections: ReportSection[];
  citations: ReportCitation[];
};
```

Implement `listClaims({ projectId })` against `claims`, and `publishReviewed` with:

```ts
client.rpc("publish_reviewed_report", {
  requested_project_id: projectId,
  requested_base_report_id: baseReportId,
  requested_markdown: markdown,
  requested_sections: sections,
  requested_citations: citations,
});
```

In `store.publish`, validate owner input, find the requested base version from `listVersions`, map Claim rows, derive with `createReviewedReportSnapshot`, call the RPC, and return `mapReportRow(requireFirstRow(rows))`. Do not mutate or overwrite the base report.

- [ ] **Step 4: Run Report Store tests and verify GREEN**

Run: `npm run test:unit -- tests/unit/report-store.test.ts tests/unit/reviewed-report.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing Server Action tests**

Change the successful mock to return a complete published report and assert:

```ts
expect(result).toEqual({ ok: true, report: publishedReport });
expect(calls).toEqual(["authorize", "publish", "revalidate-workspace", "revalidate-public"]);
```

Add stable error cases for `REPORT_REVIEW_INCOMPLETE` and `REPORT_NO_ACCEPTED_CONTENT`.

- [ ] **Step 6: Run Server Action tests and verify RED**

Run: `npm run test:unit -- tests/unit/report-actions.test.ts`

Expected: FAIL because the action returns slug/version fields instead of a complete report and does not map the new codes.

- [ ] **Step 7: Return the complete reviewed report and map stable codes**

Extend `reportActionErrorCodes` with:

```ts
"REPORT_REVIEW_INCOMPLETE",
"REPORT_NO_ACCEPTED_CONTENT",
```

Return:

```ts
return { ok: true as const, report: result };
```

Revalidate the workspace and `/r/${result.slug}` only after the reviewed RPC succeeds.

- [ ] **Step 8: Run Server Action tests and verify GREEN**

Run: `npm run test:unit -- tests/unit/report-actions.test.ts tests/unit/report-store.test.ts`

Expected: PASS.

- [ ] **Step 9: Write failing workspace readiness and publication tests**

Add component tests that assert:

```tsx
expect(screen.getByText("还需审核 1 条报告引用主张")).toBeVisible();
expect(screen.getByRole("button", { name: "发布此版本" })).toBeDisabled();
await user.click(screen.getByRole("button", { name: "审核下一条" }));
expect(screen.getByRole("button", { name: pendingClaim.statement })).toHaveAttribute(
  "aria-pressed",
  "true",
);
```

At 390px behavior, assert the “审核下一条” action changes the active mobile tab to `主张`. Add a rejected/no-pending case that says rejected paragraphs will be excluded while leaving publish enabled. Change the successful publication mock to return `report: reviewedPublishedReport`, then assert version 3 is inserted, selected, and the old published version becomes revoked. Add distinct alert assertions for review-incomplete and no-accepted-content action failures.

- [ ] **Step 10: Run workspace UI tests and verify RED**

Run: `npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx`

Expected: FAIL because `WorkspaceReport` does not receive Claims or readiness-navigation callbacks.

- [ ] **Step 11: Implement report readiness UI and immutable version insertion**

Pass to `WorkspaceReport`:

```tsx
claims={claims}
onReviewClaim={(claimId) => {
  setSelectedClaimId(claimId);
  setActiveMobileTab("claims");
}}
```

In `WorkspaceReport`, compute readiness for `selectedReport`, show a compact inline status region, disable publish only when `pendingClaimIds.length > 0`, and expose “审核下一条” for the first pending referenced Claim. When rejected Claims remain, show a warning that affected paragraphs will be excluded. On success:

```ts
setReports((current) => [
  result.report,
  ...current.map((report) =>
    report.status === "published"
      ? { ...report, slug: undefined, status: "revoked" as const }
      : report,
  ),
]);
setSelectedReportId(result.report.id);
```

Use separate `actionError` values for `reviewIncomplete`, `noAcceptedContent`, generic publish, and revoke. Add restrained CSS for the readiness block without nesting a card inside the report tool.

- [ ] **Step 12: Add bilingual report-readiness copy**

Add matching keys:

```json
"reviewPending": "还需审核 {count} 条报告引用主张",
"reviewNext": "审核下一条",
"reviewRejected": "发布时将排除涉及 {count} 条已拒绝主张的段落。",
"reviewReady": "报告引用主张已完成审核。",
"reviewIncompleteError": "报告引用主张尚未全部审核。",
"noAcceptedContentError": "没有可发布的已接受事实内容。"
```

English values must convey the same meaning and use the same variables.

- [ ] **Step 13: Run workspace UI tests and verify GREEN**

Run: `npm run test:unit -- tests/unit/evidence-workspace-ui.test.tsx tests/unit/report-actions.test.ts tests/unit/report-store.test.ts`

Expected: PASS.

- [ ] **Step 14: Commit Task 4**

```bash
git add src/features/reports/report-store.ts src/features/reports/actions.ts src/components/evidence-workspace/evidence-workspace.tsx src/components/evidence-workspace/workspace-report.tsx src/components/evidence-workspace/evidence-workspace.module.css messages/zh.json messages/en.json tests/unit/report-store.test.ts tests/unit/report-actions.test.ts tests/unit/evidence-workspace-ui.test.tsx
git commit -m "feat(c2): 让人工审核约束报告发布"
```

### Task 5: Add the Atomic Reviewed Report Publishing RPC

**Files:**
- Create: `supabase/migrations/20260728000100_reviewed_report_publishing.sql`
- Modify: `supabase/tests/04_report_publishing.sql`

- [ ] **Step 1: Rewrite the pgTAP fixture around reviewed publication**

Insert accepted, pending, and rejected Claims for the existing publishing project. Use base reports with accepted-only, pending, rejected-only, and mixed Citations. Change the plan count to the exact final assertion count and replace calls to `publish_report_version` with:

```sql
select *
from public.publish_reviewed_report(
  'publish_project',
  'publish_report_v1',
  'Accepted finding [link_1]',
  '[{"id":"section_1","heading":"Finding","factual":true,"markdown":"Accepted finding [link_1]","citationIds":["link_1"]}]'::jsonb,
  '[{"evidenceLinkId":"link_1","claimId":"claim_1","chunkId":"chunk_1","sourceId":"source_1","quote":"Exact quote v1","sourceUrl":"https://example.com/source-v1","sourceTitle":"Source v1"}]'::jsonb
);
```

Add assertions for pending blocking, rejected-only/no factual content, non-accepted Citation rejection, Citation-not-in-base rejection, foreign owner rejection, next version insertion, base report unchanged, old published revocation, stable slug, one published row, audit metadata, public read, revoke, and anon permission denial.

- [ ] **Step 2: Run hosted pgTAP and verify RED**

Run: `npm run test:db:hosted`

Expected: FAIL because `publish_reviewed_report` is absent. This command targets only the linked managed development database and must not target Production.

- [ ] **Step 3: Create the reviewed publication migration**

Create the migration with this function body, then apply the grants shown below:

```sql
drop function if exists public.publish_report_version(text, text);

create function public.publish_reviewed_report(
  requested_project_id text,
  requested_base_report_id text,
  requested_markdown text,
  requested_sections jsonb,
  requested_citations jsonb
)
returns table (
  id text,
  run_id text,
  project_id text,
  slug text,
  markdown text,
  sections jsonb,
  citations jsonb,
  version integer,
  status text,
  published_at timestamptz,
  created_at timestamptz
)
language plpgsql
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  current_project public.projects%rowtype;
  base_report public.reports%rowtype;
  new_report public.reports%rowtype;
  requested_section jsonb;
  base_section jsonb;
  requested_citation jsonb;
  base_citation jsonb;
  requested_paragraph text;
  citation_id text;
  base_citation_id text;
  claim_status text;
  paragraph_has_citation boolean;
  rebuilt_markdown text;
  next_version integer;
  published_timestamp timestamptz := now();
begin
  select project.*
  into current_project
  from public.projects as project
  where project.id = requested_project_id
    and project.owner_id = current_owner
  for update;

  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;
  if current_project.status <> 'active' then
    raise exception 'PROJECT_NOT_PUBLISHABLE';
  end if;

  select report.*
  into base_report
  from public.reports as report
  where report.id = requested_base_report_id
    and report.project_id = requested_project_id
  for update;

  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;
  if base_report.status not in ('draft', 'revoked')
    or jsonb_typeof(base_report.sections) <> 'array'
    or jsonb_typeof(base_report.citations) <> 'array'
  then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  for base_citation in
    select citation.value from jsonb_array_elements(base_report.citations) as citation(value)
  loop
    if jsonb_typeof(base_citation -> 'evidenceLinkId') <> 'string'
      or jsonb_typeof(base_citation -> 'claimId') <> 'string'
      or btrim(base_citation ->> 'evidenceLinkId') = ''
      or btrim(base_citation ->> 'claimId') = ''
    then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    select claim.review_status
    into claim_status
    from public.claims as claim
    where claim.id = base_citation ->> 'claimId'
      and claim.project_id = requested_project_id
    for share;

    if not found then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;
    if claim_status = 'pending' then
      raise exception 'REPORT_REVIEW_INCOMPLETE';
    end if;
  end loop;

  if btrim(requested_markdown) = ''
    or jsonb_typeof(requested_sections) <> 'array'
    or jsonb_array_length(requested_sections) = 0
    or jsonb_typeof(requested_citations) <> 'array'
  then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  if (
    select count(*) <> count(distinct section.value ->> 'id')
    from jsonb_array_elements(requested_sections) as section(value)
  ) then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  for requested_section in
    select section.value from jsonb_array_elements(requested_sections) as section(value)
  loop
    if jsonb_typeof(requested_section -> 'id') <> 'string'
      or jsonb_typeof(requested_section -> 'heading') <> 'string'
      or jsonb_typeof(requested_section -> 'factual') <> 'boolean'
      or jsonb_typeof(requested_section -> 'markdown') <> 'string'
      or jsonb_typeof(requested_section -> 'citationIds') <> 'array'
      or btrim(requested_section ->> 'id') = ''
      or btrim(requested_section ->> 'heading') = ''
      or btrim(requested_section ->> 'markdown') = ''
    then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    select section.value
    into base_section
    from jsonb_array_elements(base_report.sections) as section(value)
    where section.value ->> 'id' = requested_section ->> 'id'
      and section.value ->> 'heading' = requested_section ->> 'heading'
      and section.value -> 'factual' = requested_section -> 'factual'
      and jsonb_typeof(section.value -> 'citationIds') = 'array';

    if not found then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    if (
      select count(*) <> count(distinct citation.value #>> '{}')
      from jsonb_array_elements(requested_section -> 'citationIds') as citation(value)
    ) then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    for citation_id in
      select citation.value #>> '{}'
      from jsonb_array_elements(requested_section -> 'citationIds') as citation(value)
    loop
      if citation_id is null or btrim(citation_id) = '' or not exists (
        select 1
        from jsonb_array_elements(base_section -> 'citationIds') as citation(value)
        where citation.value #>> '{}' = citation_id
      ) then
        raise exception 'REPORT_NOT_PUBLISHABLE';
      end if;
    end loop;

    for requested_paragraph in
      select btrim(paragraph.value)
      from regexp_split_to_table(requested_section ->> 'markdown', E'\\n[[:space:]]*\\n')
        as paragraph(value)
      where btrim(paragraph.value) <> ''
    loop
      if not exists (
        select 1
        from regexp_split_to_table(base_section ->> 'markdown', E'\\n[[:space:]]*\\n')
          as paragraph(value)
        where btrim(paragraph.value) = requested_paragraph
      ) then
        raise exception 'REPORT_NOT_PUBLISHABLE';
      end if;

      paragraph_has_citation := false;
      for base_citation_id in
        select citation.value #>> '{}'
        from jsonb_array_elements(base_section -> 'citationIds') as citation(value)
      loop
        if strpos(requested_paragraph, '[' || base_citation_id || ']') > 0 then
          paragraph_has_citation := true;
          if not exists (
            select 1
            from jsonb_array_elements(requested_section -> 'citationIds') as citation(value)
            where citation.value #>> '{}' = base_citation_id
          ) then
            raise exception 'REPORT_NOT_PUBLISHABLE';
          end if;
        end if;
      end loop;

      if (requested_section ->> 'factual')::boolean and not paragraph_has_citation then
        raise exception 'REPORT_NOT_PUBLISHABLE';
      end if;
    end loop;
  end loop;

  select string_agg(
    '## ' || section.value ->> 'heading' || E'\n\n' || section.value ->> 'markdown',
    E'\n\n' order by section.ordinality
  )
  into rebuilt_markdown
  from jsonb_array_elements(requested_sections) with ordinality
    as section(value, ordinality);

  if rebuilt_markdown is distinct from requested_markdown then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(requested_sections) as section(value)
    where section.value -> 'factual' = 'true'::jsonb
  ) then
    raise exception 'REPORT_NO_ACCEPTED_CONTENT';
  end if;

  if (
    select count(*) <> count(distinct citation.value ->> 'evidenceLinkId')
    from jsonb_array_elements(requested_citations) as citation(value)
  ) then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  for requested_citation in
    select citation.value from jsonb_array_elements(requested_citations) as citation(value)
  loop
    if jsonb_typeof(requested_citation -> 'evidenceLinkId') <> 'string'
      or jsonb_typeof(requested_citation -> 'claimId') <> 'string'
      or jsonb_typeof(requested_citation -> 'chunkId') <> 'string'
      or jsonb_typeof(requested_citation -> 'sourceId') <> 'string'
      or jsonb_typeof(requested_citation -> 'quote') <> 'string'
      or jsonb_typeof(requested_citation -> 'sourceUrl') <> 'string'
      or jsonb_typeof(requested_citation -> 'sourceTitle') <> 'string'
      or not base_report.citations @> jsonb_build_array(requested_citation)
    then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(requested_sections) as section(value),
        jsonb_array_elements(section.value -> 'citationIds') as citation(value)
      where citation.value #>> '{}' = requested_citation ->> 'evidenceLinkId'
    ) then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    select claim.review_status
    into claim_status
    from public.claims as claim
    where claim.id = requested_citation ->> 'claimId'
      and claim.project_id = requested_project_id
    for share;

    if not found or claim_status <> 'accepted' then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;
  end loop;

  select coalesce(max(report.version), 0) + 1
  into next_version
  from public.reports as report
  where report.project_id = requested_project_id;

  update public.reports
  set status = 'revoked', slug = null
  where project_id = requested_project_id and status = 'published';

  insert into public.reports (
    id,
    run_id,
    project_id,
    slug,
    markdown,
    sections,
    citations,
    version,
    status,
    published_at,
    created_at
  )
  values (
    'report_' || replace(gen_random_uuid()::text, '-', ''),
    base_report.run_id,
    requested_project_id,
    current_project.slug,
    requested_markdown,
    requested_sections,
    requested_citations,
    next_version,
    'published',
    published_timestamp,
    published_timestamp
  )
  returning * into new_report;

  update public.projects
  set visibility = 'public', updated_at = published_timestamp
  where id = requested_project_id;

  insert into public.audit_events (owner_id, project_id, action, metadata)
  values (
    current_owner,
    requested_project_id,
    'report.published',
    jsonb_build_object(
      'baseReportId', requested_base_report_id,
      'reportId', new_report.id,
      'version', new_report.version
    )
  );

  return query
  select
    new_report.id,
    new_report.run_id,
    new_report.project_id,
    new_report.slug,
    new_report.markdown,
    new_report.sections,
    new_report.citations,
    new_report.version,
    new_report.status,
    new_report.published_at,
    new_report.created_at;
end;
$$;

revoke all
on function public.publish_reviewed_report(text, text, text, jsonb, jsonb)
from public;

grant execute
on function public.publish_reviewed_report(text, text, text, jsonb, jsonb)
to authenticated, service_role;
```

Required validation details:

- `auth.uid()` is the only owner source; no owner parameter exists.
- The base report belongs to the locked project and has `draft` or `revoked` status.
- Every Claim referenced by the base report exists in the same project.
- Any pending referenced Claim raises `REPORT_REVIEW_INCOMPLETE` before writes.
- `requested_sections` and `requested_citations` are JSON arrays; Markdown is non-empty.
- Every submitted Citation object exists unchanged in the base report Citations and its current Claim is accepted.
- Every section Citation ID exists in submitted Citations; factual sections have at least one Citation; at least one factual section remains.
- Empty accepted factual content raises `REPORT_NO_ACCEPTED_CONTENT`; malformed/subset violations raise `REPORT_NOT_PUBLISHABLE`.
- The inserted ID is a new text ID, the run ID comes from the base report, and version is `max(project version) + 1` under the project lock.
- The old published row becomes `revoked` with `slug = null`; the new row is `published` with the project slug and one timestamp.
- Audit metadata contains `baseReportId`, `reportId`, and `version`.
- Revoke all privileges from `public`; grant execute only to `authenticated, service_role`.

- [ ] **Step 4: Apply only the new migration to the managed development database**

Use the repository’s linked Supabase CLI workflow after confirming the linked project is the development project. Do not run a Production migration, update `release`, or modify Production environment variables.

- [ ] **Step 5: Run pgTAP and Schema lint and verify GREEN**

Run: `npm run test:db:hosted`

Expected: all pgTAP assertions pass and Supabase Schema lint reports no errors.

- [ ] **Step 6: Commit Task 5**

```bash
git add supabase/migrations/20260728000100_reviewed_report_publishing.sql supabase/tests/04_report_publishing.sql
git commit -m "feat(c2): 原子发布已审核报告版本"
```

### Task 6: Add End-to-End Coverage, Visual Acceptance, and Close the Milestone

**Files:**
- Modify: `tests/e2e/evidence-workspace.spec.ts`
- Modify: `tests/e2e/evidence-workspace-visual.spec.ts`
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/development-plan.md`

- [ ] **Step 1: Write failing fixture E2E assertions**

Add browser coverage that:

- keeps the first Claim visible after disabling its only Evidence relation;
- shows an Evidence-less Claim with `0 条证据` when the deterministic fixture contains one;
- opens the report view, shows pending review readiness, invokes “审核下一条”, and returns to the selected Claim on mobile;
- after fixture Claim statuses contain accepted and rejected references but no pending, shows the exclusion warning and an enabled publish control only in managed component coverage;
- preserves existing citation-to-source navigation and revoke/public-report coverage.

The static demo route must not call managed write actions. Actual atomic publication is covered by Store/Action tests, pgTAP, and the authenticated managed browser acceptance in Step 7.

- [ ] **Step 2: Run focused E2E and verify RED**

Run: `npm run build && npx playwright test tests/e2e/evidence-workspace.spec.ts`

Expected: at least the new Claim visibility/readiness assertion fails before the fixture/UI updates are complete.

- [ ] **Step 3: Make the deterministic fixture exercise C2 states without Provider calls**

Update only the existing fixture data needed by the E2E assertions. Do not introduce a test-only write API or enable Supabase/Provider configuration in Playwright.

- [ ] **Step 4: Run focused E2E and verify GREEN**

Run: `npm run build && npx playwright test tests/e2e/evidence-workspace.spec.ts`

Expected: PASS.

- [ ] **Step 5: Extend three-viewport visual audit checks**

At each existing viewport (`390x844`, `1024x768`, `1440x1000`), capture and audit:

- the full Claim list with an Evidence-less Claim;
- report readiness with pending Claims;
- reviewed report warning/selected version state;
- no horizontal overflow, text clipping, control overlap, abnormal blank report/graph area, or layout shift caused by long Claim text and readiness copy.

- [ ] **Step 6: Run the complete automated module gate**

Run in order with Node `22.22.1`:

```bash
git diff --check
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
npm run test:managed
```

Expected: all commands pass. `test:managed` must use fixture Provider boundaries and the linked development database only; no Tavily, DeepSeek, Bailian, or other paid Provider call is authorized.

- [ ] **Step 7: Start C2 locally and perform authenticated browser acceptance**

Replace the old C1 app process only after the C2 build passes, then start the C2 worktree on fixed URLs:

```text
App: http://127.0.0.1:3218/zh
Inngest: http://127.0.0.1:8288
```

Using the existing authenticated Chrome session, verify a real managed project at `390x844`, `1024x768`, and `1440x1000`:

- all stored Claims appear, including those with zero Evidence Links;
- disabling Evidence relations changes the graph but not the Claim list;
- a failed new-research submission preserves title, question, language, URL values, and URL row count;
- the project list shows `活跃`, while a completed workspace shows `运行完成`;
- pending report Citations disable publication and “审核下一条” selects the right Claim;
- rejecting a cited Claim produces an exclusion warning;
- publishing creates and selects a new higher version, preserves the base draft, removes the rejected paragraph from the public page, and keeps the stable slug;
- revoking makes the public route return 404;
- browser console has no application errors and no viewport has horizontal overflow, clipping, overlap, or blank graph/report output.

Reset the Chrome viewport override and finalize the browser tab/session after acceptance.

- [ ] **Step 8: Update project state and commit the verified milestone**

Record actual counts, migration state, local URLs, browser results, and the fact that paid Provider regression was not run without a separate cost gate.

```bash
git add PROJECT_STATUS.md docs/roadmap.md docs/development-plan.md tests/e2e/evidence-workspace.spec.ts tests/e2e/evidence-workspace-visual.spec.ts
git commit -m "test(c2): 完成核心研究闭环验收"
```

- [ ] **Step 9: Create one Draft PR and run independent review immediately**

Push `feat/c2-core-loop-hardening`, create the single C2 Draft PR, update `PROJECT_STATUS.md` with its number and CI state, then run:

```bash
claude --permission-mode auto --model sonnet -p "/codex-independent-pr-review <PR编号>"
```

Claude reviews/comments only. It must not modify code, commit, push, or merge. Do not wait for user acceptance before starting this review.

- [ ] **Step 10: Resolve review/CI findings and merge**

For each valid finding, reproduce it with a failing test, implement the minimum fix, rerun focused and full gates, push, and rerun independent review against the new head SHA. When Claude returns `pass` for the current head and GitHub CI is green:

```bash
gh pr merge <PR编号> --merge --delete-branch
```

Use a merge commit. Do not squash, rebase, force push, update `release`, or deploy Production.
