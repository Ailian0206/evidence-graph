import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/zh.json";
import { ManagedAppShell } from "@/components/projects/managed-app-shell";

vi.mock("@/features/auth/actions", () => ({
  signOut: vi.fn(async () => undefined),
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

afterEach(cleanup);

describe("managed app shell", () => {
  it("shows workspace navigation and the minimum signed-in identity", () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <ManagedAppShell
          active="projects"
          locale="zh"
          user={{ displayName: "ailian", email: "user@example.com" }}
        >
          <p>工作区内容</p>
        </ManagedAppShell>
      </NextIntlClientProvider>,
    );

    const navigation = screen.getByRole("navigation", { name: "工作台导航" });
    expect(within(navigation).getByRole("link", { name: "研究项目" })).toHaveAttribute(
      "href",
      "/zh/app",
    );
    expect(within(navigation).getByRole("link", { name: "研究报告" })).toHaveAttribute(
      "href",
      "/zh/app/reports",
    );
    expect(within(navigation).getByRole("link", { name: "研究项目" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("ailian")).toBeVisible();
    expect(screen.getByText("user@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeVisible();
    expect(screen.getByText("工作区内容")).toBeVisible();
  });

  it("uses a stable account fallback when the provider has no profile fields", () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <ManagedAppShell
          active="reports"
          locale="zh"
          user={{ displayName: null, email: null }}
        >
          <p>报告内容</p>
        </ManagedAppShell>
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("已登录账户")).toBeVisible();
    expect(screen.getByRole("link", { name: "研究报告" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
