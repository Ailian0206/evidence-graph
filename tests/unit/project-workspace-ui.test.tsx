import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/zh.json";
import { NewResearchForm } from "@/components/projects/new-research-form";
import { ProjectDashboard } from "@/components/projects/project-dashboard";
import { createResearch, deleteProject } from "@/features/projects/actions";
import type { ManagedProject } from "@/features/projects/project-store";

vi.mock("@/features/projects/actions", () => ({
  archiveProject: vi.fn(async () => undefined),
  createResearch: vi.fn(async (_locale, state) => state),
  deleteProject: vi.fn(async () => undefined),
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

const project: ManagedProject = {
  id: "project_1",
  ownerId: "owner_1",
  title: "可核查的 AI 研究",
  question: "精确引用如何降低研究审核成本？",
  language: "zh",
  status: "active",
  visibility: "private",
  slug: "research-project_1",
  createdAt: "2026-07-16T08:00:00.000Z",
  updatedAt: "2026-07-16T08:00:00.000Z",
};

const renderWithMessages = (children: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="zh" messages={messages}>
      {children}
    </NextIntlClientProvider>,
  );

afterEach(cleanup);

describe("managed project workspace UI", () => {
  it("renders a useful empty dashboard state", () => {
    renderWithMessages(<ProjectDashboard locale="zh" projects={[]} />);

    expect(screen.getByRole("heading", { name: "还没有研究项目" })).toBeVisible();
    expect(screen.getByRole("link", { name: "新建研究" })).toHaveAttribute(
      "href",
      "/zh/app/research/new",
    );
  });

  it("renders project status and update time", () => {
    renderWithMessages(<ProjectDashboard locale="zh" projects={[project]} />);

    expect(screen.getByRole("heading", { name: project.title })).toBeVisible();
    expect(screen.getByRole("link", { name: project.title })).toHaveAttribute(
      "href",
      "/zh/app/research/project_1",
    );
    expect(screen.getByText("进行中")).toBeVisible();
    expect(screen.getByText(/2026/)).toBeVisible();
    expect(screen.getByRole("button", { name: "归档可核查的 AI 研究" })).toBeVisible();
    expect(screen.getByRole("button", { name: "删除可核查的 AI 研究" })).toBeVisible();
  });

  it("keeps project rows and destructive actions semantically separate", () => {
    renderWithMessages(<ProjectDashboard locale="zh" projects={[project]} />);

    const row = screen.getByRole("listitem");
    expect(within(row).getByRole("link", { name: project.title })).toBeVisible();
    expect(within(row).getByText("进行中")).toHaveAttribute("data-status", "active");
    expect(within(row).getByRole("button", { name: /删除/ })).toHaveAttribute(
      "data-variant",
      "danger",
    );
  });

  it("declares autocomplete and stable form regions", () => {
    renderWithMessages(<NewResearchForm locale="zh" />);

    expect(screen.getByRole("textbox", { name: "项目标题" })).toHaveAttribute(
      "autocomplete",
      "off",
    );
    expect(screen.getByRole("textbox", { name: "研究问题" })).toHaveAttribute(
      "autocomplete",
      "off",
    );
    expect(screen.getByTestId("research-primary-fields")).toBeVisible();
    expect(screen.getByTestId("research-source-fields")).toBeVisible();
    expect(screen.getByTestId("research-form-actions")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("adds no more than five manual URL fields", async () => {
    const user = userEvent.setup();
    renderWithMessages(<NewResearchForm locale="zh" />);
    const addButton = screen.getByRole("button", { name: "添加来源链接" });

    for (let index = 0; index < 4; index += 1) {
      await user.click(addButton);
    }

    expect(screen.getAllByRole("textbox", { name: /来源链接/ })).toHaveLength(5);
    expect(addButton).toBeDisabled();

    await user.click(screen.getAllByRole("button", { name: /移除来源链接/ })[0]);
    expect(screen.getAllByRole("textbox", { name: /来源链接/ })).toHaveLength(4);
    expect(addButton).toBeEnabled();
  });

  it("explains when another research run is already active", async () => {
    const user = userEvent.setup();
    vi.mocked(createResearch).mockResolvedValueOnce({
      status: "error",
      code: "ACTIVE_RESEARCH_RUN_EXISTS",
    } as never);
    renderWithMessages(<NewResearchForm locale="zh" />);

    await user.type(screen.getByRole("textbox", { name: "项目标题" }), "并发研究");
    await user.type(screen.getByRole("textbox", { name: "研究问题" }), "何时可以再次创建研究？");
    await user.click(screen.getByRole("button", { name: "创建研究" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "已有研究正在处理，请等待完成后再创建新的研究。",
    );
  });

  it("does not delete a project when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithMessages(<ProjectDashboard locale="zh" projects={[project]} />);

    await user.click(screen.getByRole("button", { name: "删除可核查的 AI 研究" }));

    expect(confirm).toHaveBeenCalledWith("确认删除“可核查的 AI 研究”？此操作无法撤销。");
    expect(deleteProject).not.toHaveBeenCalled();
  });
});
