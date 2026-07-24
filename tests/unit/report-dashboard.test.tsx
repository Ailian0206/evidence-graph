import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/zh.json";
import { ReportDashboard } from "@/components/reports/report-dashboard";
import type { ManagedReportSummary } from "@/features/reports/report-list-store";

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

const publishedReport: ManagedReportSummary = {
  id: "report_2",
  projectId: "project_1",
  projectTitle: "可核查的 AI 研究",
  question: "精确引用如何降低研究审核成本？",
  language: "zh",
  version: 2,
  status: "published",
  slug: "research-project-1",
  publishedAt: "2026-07-17T10:00:00.000Z",
  createdAt: "2026-07-17T09:00:00.000Z",
};

afterEach(cleanup);

describe("report dashboard", () => {
  it("links each report to its research and published output", () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <ReportDashboard locale="zh" reports={[publishedReport]} />
      </NextIntlClientProvider>,
    );

    const row = screen.getByRole("listitem");
    expect(within(row).getByRole("heading", { name: "可核查的 AI 研究" })).toBeVisible();
    expect(within(row).getByText("版本 2")).toBeVisible();
    expect(within(row).getByText("已发布")).toBeVisible();
    expect(within(row).getByRole("link", { name: "打开研究" })).toHaveAttribute(
      "href",
      "/zh/app/research/project_1",
    );
    expect(within(row).getByRole("link", { name: "打开公开报告" })).toHaveAttribute(
      "href",
      "/r/research-project-1",
    );
  });

  it("does not offer a public link for a draft", () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <ReportDashboard
          locale="zh"
          reports={[
            {
              ...publishedReport,
              id: "report_1",
              status: "draft",
              slug: undefined,
              publishedAt: undefined,
            },
          ]}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("草稿")).toBeVisible();
    expect(screen.queryByRole("link", { name: "打开公开报告" })).toBeNull();
  });

  it("renders an empty state with a new research entry", () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <ReportDashboard locale="zh" reports={[]} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "还没有研究报告" })).toBeVisible();
    expect(screen.getByRole("link", { name: "新建研究" })).toHaveAttribute(
      "href",
      "/zh/app/research/new",
    );
  });
});
