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
    { locale: "zh", messages: zhMessages, label: "研究工作台", navigation: "主导航" },
    {
      locale: "en",
      messages: enMessages,
      label: "Research workspace",
      navigation: "Primary navigation",
    },
  ])("exposes the managed workspace from the $locale public navigation", ({
    locale,
    messages,
    label,
    navigation,
  }) => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>,
    );

    expect(
      within(screen.getByRole("navigation", { name: navigation })).getByRole("link", {
        name: label,
      }),
    ).toHaveAttribute("href", "/app");
  });
});
