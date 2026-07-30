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
    locale: _locale,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    locale?: string;
  }) => {
    void _locale;
    return (
      <a href={`/zh${href}`} {...props}>
        {children}
      </a>
    );
  },
  usePathname: () => "/app",
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
    expect(screen.getByRole("banner")).toHaveAttribute("data-product-shell", "true");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(within(navigation).getByRole("link", { name: "研究项目" })).toHaveAttribute(
      "href",
      "/zh/app",
    );
    expect(within(navigation).getByRole("link", { name: "报告库" })).toHaveAttribute(
      "href",
      "/zh/app/reports",
    );
    expect(within(navigation).getByRole("link", { name: "设置" })).toHaveAttribute(
      "href",
      "/zh/app/settings",
    );
    expect(within(navigation).getByRole("link", { name: "研究项目" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("ailian")).toBeVisible();
    expect(screen.getByText("user@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeVisible();
    expect(screen.getByRole("link", { name: "返回 Ailian 作品集" })).toHaveAttribute(
      "href",
      "/zh/",
    );
    expect(screen.getByRole("link", { name: "English" })).toBeVisible();
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
    expect(screen.getByRole("link", { name: "报告库" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("uses a compact product shell for login and anonymous demo routes", () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <ManagedAppShell locale="zh">
          <p>匿名产品内容</p>
        </ManagedAppShell>
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("link", { name: "返回 Ailian 作品集" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Evidence Graph" })).toHaveAttribute(
      "href",
      "/zh/app",
    );
    expect(screen.getByRole("link", { name: "English" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "工作台导航" })).toBeNull();
    expect(screen.queryByRole("button", { name: "退出登录" })).toBeNull();
    expect(screen.getByText("匿名产品内容")).toBeVisible();
    expect(screen.getByRole("main")).toHaveTextContent("匿名产品内容");
  });
});
