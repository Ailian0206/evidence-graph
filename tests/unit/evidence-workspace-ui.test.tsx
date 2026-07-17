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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigationMocks.refresh }),
}));

vi.mock("@/features/projects/actions", () => projectActionMocks);

const renderWorkspace = () =>
  render(
    <NextIntlClientProvider locale="zh" messages={messages}>
      <EvidenceWorkspace initialData={createEvidenceWorkspaceFixture("zh")} />
    </NextIntlClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("evidence workspace claim review", () => {
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

  it("accepts and rejects a claim without changing the model statement", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const targetClaim = workspace.claims[0];
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: targetClaim.statement }));
    await user.click(screen.getByRole("button", { name: "接受主张" }));

    const selectedClaim = screen.getByTestId("selected-claim");
    expect(within(selectedClaim).getByText(targetClaim.statement)).toBeVisible();
    expect(
      within(selectedClaim).getByRole("status", { name: "当前审核状态" }),
    ).toHaveTextContent("已接受");

    await user.click(screen.getByRole("button", { name: "拒绝主张" }));

    expect(within(selectedClaim).getByText(targetClaim.statement)).toBeVisible();
    expect(
      within(selectedClaim).getByRole("status", { name: "当前审核状态" }),
    ).toHaveTextContent("已拒绝");
  });

  it("hides claims when their only evidence relation is disabled", async () => {
    const user = userEvent.setup();
    const workspace = createEvidenceWorkspaceFixture("zh");
    const supportedClaim = workspace.claims[0];
    renderWorkspace();

    await user.click(screen.getByRole("checkbox", { name: "支持" }));

    expect(screen.queryByRole("button", { name: supportedClaim.statement })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "支持" })).not.toBeChecked();
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
      act(() => vi.advanceTimersByTime(3000));
      expect(navigationMocks.refresh).toHaveBeenCalledTimes(1);
    },
  );

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
