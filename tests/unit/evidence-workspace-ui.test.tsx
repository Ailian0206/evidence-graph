import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/zh.json";
import { EvidenceWorkspace } from "@/components/evidence-workspace/evidence-workspace";
import { ManagedWorkspaceState } from "@/components/evidence-workspace/managed-workspace-state";
import { WorkspaceState } from "@/components/evidence-workspace/workspace-state";
import { createEvidenceWorkspaceFixture } from "@/features/research/evidence-workspace-fixture";

const navigationMocks = vi.hoisted(() => ({ refresh: vi.fn() }));
const projectActionMocks = vi.hoisted(() => ({
  retryResearchDispatch: vi.fn(async () => ({ ok: true as const })),
}));
const researchActionMocks = vi.hoisted(() => ({
  reviewClaim: vi.fn(async () => ({ ok: true as const })),
}));
const reportActionMocks = vi.hoisted(() => ({
  publishReport: vi.fn(
    async (): Promise<
      | {
          ok: true;
          slug: string;
          version: number;
          publishedAt: string;
        }
      | { ok: false; code: string }
    > => ({
      ok: true,
      slug: "traceable-citations-review-zh",
      version: 2,
      publishedAt: "2026-07-17T10:00:00.000Z",
    }),
  ),
  revokeReport: vi.fn(async () => ({
    ok: true as const,
    slug: "traceable-citations-review-zh",
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigationMocks.refresh }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={`/zh${href}`} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/projects/actions", () => projectActionMocks);
vi.mock("@/features/research/actions", () => researchActionMocks);
vi.mock("@/features/reports/actions", () => reportActionMocks);

const renderWorkspace = (
  persistence: "demo" | "managed" = "demo",
  initialData = createEvidenceWorkspaceFixture("zh"),
) =>
  render(
    <NextIntlClientProvider locale="zh" messages={messages}>
      <EvidenceWorkspace initialData={initialData} persistence={persistence} />
    </NextIntlClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("evidence workspace claim review", () => {
  it("renders review actions inside only the selected claim card", () => {
    const workspace = createEvidenceWorkspaceFixture("zh");
    renderWorkspace();

    const selectedCard = screen.getByRole("article", {
      name: workspace.claims[0].statement,
    });
    const otherCard = screen.getByRole("article", {
      name: workspace.claims[1].statement,
    });

    expect(within(selectedCard).getByRole("button", { name: "接受主张" })).toBeVisible();
    expect(within(selectedCard).getByRole("button", { name: "拒绝主张" })).toBeVisible();
    expect(within(otherCard).queryByRole("button", { name: "接受主张" })).toBeNull();
    expect(screen.queryByTestId("selected-claim")).toBeNull();
    expect(screen.getByText("运行完成")).toBeVisible();
  });

  it("filters the claim list by human review status", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const acceptedClaim = workspace.claims.find(
      (claim) => claim.reviewStatus === "accepted",
    );
    const pendingClaim = workspace.claims.find(
      (claim) => claim.reviewStatus === "pending",
    );
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "已接受" }));

    expect(screen.getByRole("button", { name: acceptedClaim?.statement })).toBeVisible();
    expect(screen.queryByRole("button", { name: pendingClaim?.statement })).toBeNull();
  });

  it("accepts a claim and advances to the next pending claim", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const targetClaim = workspace.claims[0];
    const nextClaim = workspace.claims[1];
    renderWorkspace();

    const targetCard = screen.getByRole("article", { name: targetClaim.statement });
    await user.click(within(targetCard).getByRole("button", { name: "接受主张" }));

    expect(screen.getByRole("button", { name: nextClaim.statement })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(targetCard).getByText("已接受")).toBeVisible();
    expect(screen.getByRole("status", { name: "审核操作结果" })).toHaveTextContent(
      "上一条主张已接受",
    );
    expect(screen.getByRole("button", { name: "撤销上一条审核" })).toBeVisible();
  });

  it("rejects the last pending claim and wraps to the first pending claim", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const firstClaim = workspace.claims[0];
    const lastPendingClaim = workspace.claims[1];
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: lastPendingClaim.statement }));
    const lastPendingCard = screen.getByRole("article", {
      name: lastPendingClaim.statement,
    });
    await user.click(within(lastPendingCard).getByRole("button", { name: "拒绝主张" }));

    expect(screen.getByRole("button", { name: firstClaim.statement })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(lastPendingCard).getByText("已拒绝")).toBeVisible();
  });

  it("stays on the reviewed claim when all pending claims are processed", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const targetClaim = workspace.claims[0];
    const claims = workspace.claims.map((claim, index) => ({
      ...claim,
      reviewStatus: index === 0 ? ("pending" as const) : ("accepted" as const),
    }));
    renderWorkspace("demo", { ...workspace, claims });

    const targetCard = screen.getByRole("article", { name: targetClaim.statement });
    await user.click(within(targetCard).getByRole("button", { name: "接受主张" }));

    expect(screen.getByRole("button", { name: targetClaim.statement })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("待审核主张已全部处理")).toBeVisible();
  });

  it("restores an accepted claim to pending from its selected card", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const acceptedClaim = workspace.claims[2];
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: acceptedClaim.statement }));
    const acceptedCard = screen.getByRole("article", { name: acceptedClaim.statement });
    await user.click(
      within(acceptedCard).getByRole("button", { name: "恢复待审核" }),
    );

    expect(within(acceptedCard).getByText("待审核")).toBeVisible();
    expect(within(acceptedCard).getByRole("button", { name: "接受主张" })).toBeVisible();
  });

  it("expires the undo action after six seconds", async () => {
    vi.useFakeTimers();
    const workspace = createEvidenceWorkspaceFixture("zh");
    renderWorkspace();

    const targetCard = screen.getByRole("article", {
      name: workspace.claims[0].statement,
    });
    fireEvent.click(within(targetCard).getByRole("button", { name: "接受主张" }));

    expect(screen.getByRole("button", { name: "撤销上一条审核" })).toBeVisible();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByRole("button", { name: "撤销上一条审核" })).toBeNull();
  });

  it("undoes the previous review and returns to that claim", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const targetClaim = workspace.claims[0];
    renderWorkspace();

    const targetCard = screen.getByRole("article", { name: targetClaim.statement });
    await user.click(within(targetCard).getByRole("button", { name: "接受主张" }));
    await user.click(screen.getByRole("button", { name: "撤销上一条审核" }));

    expect(screen.getByRole("button", { name: targetClaim.statement })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(targetCard).getByText("待审核")).toBeVisible();
    expect(researchActionMocks.reviewClaim).not.toHaveBeenCalled();
  });

  it("keeps a successful managed review result", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const targetClaim = workspace.claims[0];
    renderWorkspace("managed");

    await user.click(screen.getByRole("button", { name: targetClaim.statement }));
    await user.click(screen.getByRole("button", { name: "接受主张" }));

    await waitFor(() =>
      expect(researchActionMocks.reviewClaim).toHaveBeenCalledWith(
        "zh",
        workspace.project.id,
        targetClaim.id,
        "accepted",
      ),
    );
    expect(
      within(screen.getByRole("article", { name: targetClaim.statement })).getByText(
        "已接受",
      ),
    ).toBeVisible();
  });

  it("rolls back a managed review when persistence fails", async () => {
    let rejectReview: ((error: Error) => void) | undefined;
    researchActionMocks.reviewClaim.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectReview = reject;
        }),
    );
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const targetClaim = workspace.claims[0];
    const nextClaim = workspace.claims[1];
    renderWorkspace("managed");

    const targetCard = screen.getByRole("article", { name: targetClaim.statement });
    await user.click(within(targetCard).getByRole("button", { name: "拒绝主张" }));

    expect(screen.getByRole("button", { name: nextClaim.statement })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await act(async () => {
      rejectReview?.(new Error("DATABASE_UNAVAILABLE"));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: targetClaim.statement })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(within(targetCard).getByText("待审核")).toBeVisible();
    expect(within(targetCard).getByRole("alert")).toHaveTextContent(
      "审核状态保存失败，请重试。",
    );
  });

  it("keeps claims visible when their only evidence relation is disabled", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const supportedClaim = workspace.claims[0];
    renderWorkspace();

    await user.click(screen.getByRole("checkbox", { name: "支持" }));

    expect(screen.getByRole("button", { name: supportedClaim.statement })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "支持" })).not.toBeChecked();
  });

  it("shows an evidence-less pending claim with review actions and an empty source", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const evidenceLessClaim = {
      ...workspace.claims[0],
      id: "claim_without_evidence",
      normalizedKey: "claim without evidence",
      statement: "没有 Evidence Link 的待审核主张",
      reviewStatus: "pending" as const,
    };
    renderWorkspace("demo", {
      ...workspace,
      claims: [...workspace.claims, evidenceLessClaim],
    });

    await user.click(screen.getByRole("button", { name: evidenceLessClaim.statement }));

    const claimCard = screen.getByRole("article", { name: evidenceLessClaim.statement });
    expect(within(claimCard).getByText("0 条证据")).toBeVisible();
    expect(within(claimCard).getByRole("button", { name: "接受主张" })).toBeVisible();
    expect(within(claimCard).getByRole("button", { name: "拒绝主张" })).toBeVisible();
    expect(screen.getByTestId("workspace-source")).toHaveTextContent(
      "选择主张后查看关联来源",
    );
  });
});

describe("evidence workspace graph keyboard navigation", () => {
  it("applies consecutive key presses to the latest focused graph node", () => {
    const workspace = createEvidenceWorkspaceFixture("zh");
    renderWorkspace();
    const graph = screen.getByRole("application", {
      name: "证据关系图，使用方向键浏览节点，按回车选择",
    });

    act(() => {
      graph.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
      graph.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
      graph.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    });

    expect(screen.getByRole("button", { name: workspace.claims[1].statement })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("evidence workspace reports", () => {
  it("switches the middle panel from the graph to structured report sections", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    renderWorkspace();

    await user.click(screen.getByRole("tab", { name: "报告" }));

    expect(
      screen.getByRole("heading", { name: workspace.reports[0].sections[0].heading }),
    ).toBeVisible();
    expect(screen.queryByTestId("workspace-graph")).toBeNull();
  });

  it("publishes a selected managed report version and updates its local status", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const draft = {
      ...workspace.reports[0],
      id: "report_v2",
      slug: undefined,
      version: 2,
      status: "draft" as const,
      publishedAt: undefined,
    };
    renderWorkspace("managed", { ...workspace, reports: [draft, workspace.reports[0]] });

    await user.click(screen.getByRole("tab", { name: "报告" }));
    await user.selectOptions(screen.getByLabelText("报告版本"), "report_v2");
    await user.click(screen.getByRole("button", { name: "发布此版本" }));

    await waitFor(() =>
      expect(reportActionMocks.publishReport).toHaveBeenCalledWith(
        "zh",
        workspace.project.id,
        "report_v2",
      ),
    );
    expect(screen.getByText("已发布", { selector: "[role='status']" })).toBeVisible();
    expect(await screen.findByRole("button", { name: "撤销公开报告" })).toBeVisible();
  });

  it("keeps the selected draft unchanged when managed publication fails", async () => {
    reportActionMocks.publishReport.mockResolvedValueOnce({
      ok: false as const,
      code: "REPORT_NOT_PUBLISHABLE",
    });
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const draft = {
      ...workspace.reports[0],
      id: "report_draft",
      slug: undefined,
      status: "draft" as const,
      publishedAt: undefined,
    };
    renderWorkspace("managed", { ...workspace, reports: [draft] });

    await user.click(screen.getByRole("tab", { name: "报告" }));
    await user.click(screen.getByRole("button", { name: "发布此版本" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("报告发布失败，请重试。");
    expect(screen.getByText("草稿", { selector: "[role='status']" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "撤销公开报告" })).toBeNull();
  });

  it("synchronizes a report citation with the existing claim and source panels", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const citation = workspace.reports[0].citations[1];
    renderWorkspace();

    await user.click(screen.getByRole("tab", { name: "报告" }));
    await user.click(screen.getByRole("button", { name: citation.sourceTitle }));

    expect(
      screen.getByRole("button", { name: workspace.claims[1].statement }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("workspace-source")).toHaveTextContent(citation.sourceTitle);
    expect(screen.getByTestId("workspace-source")).toHaveTextContent(citation.quote);
  });

  it("shows the deterministic public link without calling write actions in demo mode", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    renderWorkspace();

    await user.click(screen.getByRole("tab", { name: "报告" }));

    expect(screen.getByRole("link", { name: "打开公开报告" })).toHaveAttribute(
      "href",
      `/r/${workspace.reports[0].slug}`,
    );
    expect(screen.queryByRole("button", { name: "撤销公开报告" })).toBeNull();
    expect(reportActionMocks.publishReport).not.toHaveBeenCalled();
    expect(reportActionMocks.revokeReport).not.toHaveBeenCalled();
  });
});

describe("evidence workspace states", () => {
  it("renders an empty state when a project has no reviewable claims", () => {
    const workspace = createEvidenceWorkspaceFixture("zh");

    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <EvidenceWorkspace
          initialData={{
            ...workspace,
            claims: [],
            evidenceLinks: [],
            claimRelations: [],
          }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId("workspace-state")).toHaveAttribute(
      "data-workspace-state",
      "empty",
    );
    expect(
      screen.getByRole("heading", { name: "还没有可审核的主张" }),
    ).toBeVisible();
  });

  it("renders loading and recoverable failure states", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <WorkspaceState state="loading" />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId("workspace-state")).toHaveAttribute(
      "data-workspace-state",
      "loading",
    );

    rerender(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <WorkspaceState state="failed" onAction={retry} />
      </NextIntlClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "重新载入" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["loading", "正在载入研究工作台", false],
    ["failed", "研究工作台载入失败", true],
    ["empty", "还没有可审核的主张", false],
    ["not-found", "没有找到这个研究项目", true],
  ] as const)("renders the %s state with stable guidance", async (state, title, hasAction) => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <WorkspaceState
          state={state}
          onAction={state === "failed" ? action : undefined}
          actionHref={state === "not-found" ? "/evidence" : undefined}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading", { name: title })).toBeVisible();
    expect(screen.getByTestId("workspace-state")).toHaveAttribute(
      "data-state-shell",
      "stable",
    );
    expect(
      screen.queryAllByRole("button").length + screen.queryAllByRole("link").length,
    ).toBe(hasAction ? 1 : 0);
    if (state === "failed") {
      await user.click(screen.getByRole("button", { name: "重新载入" }));
      expect(action).toHaveBeenCalledOnce();
    }
  });

  it.each(["queued", "running"] as const)(
    "refreshes a managed %s run without changing layout",
    (state) => {
      vi.useFakeTimers();
      render(
        <NextIntlClientProvider locale="zh" messages={messages}>
          <ManagedWorkspaceState
            locale="zh"
            projectId="project_1"
            result={{ state, runId: "run_1" }}
          />
        </NextIntlClientProvider>,
      );

      expect(screen.getByTestId("workspace-state")).toHaveAttribute(
        "data-workspace-state",
        state,
      );
      expect(screen.getByTestId("workspace-state")).toHaveAttribute(
        "data-state-shell",
        "stable",
      );
      expect(screen.queryByRole("button", { name: "重新投递研究" })).toBeNull();
      expect(screen.getByTestId("managed-workspace-loading")).toHaveAttribute(
        "data-loading-indicator",
        "true",
      );
      expect(screen.getByRole("link", { name: "返回项目列表" })).toHaveAttribute(
        "href",
        "/zh/app",
      );
      act(() => vi.advanceTimersByTime(3000));
      expect(navigationMocks.refresh).toHaveBeenCalledTimes(1);
    },
  );

  it("provides a project-list return path from a completed workspace", () => {
    renderWorkspace("managed");

    expect(screen.getByRole("link", { name: "返回项目列表" })).toHaveAttribute(
      "href",
      "/zh/app",
    );
  });

  it("animates active managed runs and respects reduced motion", async () => {
    const css = await readFile(
      join(process.cwd(), "src/components/evidence-workspace/evidence-workspace.module.css"),
      "utf8",
    );

    expect(css).toContain('.workspaceState[data-workspace-state="queued"] > svg');
    expect(css).toContain('.workspaceState[data-workspace-state="running"] > svg');
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("retries only the original dispatch-failed run", async () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <ManagedWorkspaceState
          locale="zh"
          projectId="project_1"
          result={{
            state: "failed",
            runId: "run_1",
            errorCode: "RESEARCH_DISPATCH_FAILED",
            canRetryDispatch: true,
          }}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "重新投递研究" }));

    await waitFor(() =>
      expect(projectActionMocks.retryResearchDispatch).toHaveBeenCalledWith(
        "zh",
        "project_1",
        "run_1",
      ),
    );
  });
});
import { readFile } from "node:fs/promises";
import { join } from "node:path";
