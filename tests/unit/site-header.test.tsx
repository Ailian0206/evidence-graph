import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../messages/en.json";
import zhMessages from "../../messages/zh.json";
import { SiteHeader } from "@/components/site/site-header";

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
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  usePathname: () => "/",
}));

afterEach(cleanup);

describe("site header", () => {
  it.each([
    {
      locale: "zh",
      messages: zhMessages,
      productLabel: "产品介绍",
      workspaceLabel: "进入工作台",
      navigation: "主导航",
    },
    {
      locale: "en",
      messages: enMessages,
      productLabel: "Product overview",
      workspaceLabel: "Open workspace",
      navigation: "Primary navigation",
    },
  ])("distinguishes the product overview and managed workspace in $locale", ({
    locale,
    messages,
    productLabel,
    workspaceLabel,
    navigation,
  }) => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>,
    );

    const primaryNavigation = within(screen.getByRole("navigation", { name: navigation }));
    expect(primaryNavigation.getByRole("link", { name: productLabel })).toHaveAttribute(
      "href",
      "/evidence",
    );
    expect(primaryNavigation.getByRole("link", { name: workspaceLabel })).toHaveAttribute(
      "href",
      "/app",
    );
  });
});
