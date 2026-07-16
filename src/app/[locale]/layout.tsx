import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { profile } from "@/content/profile";
import { routing } from "@/i18n/routing";

import "../globals.css";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return {
    metadataBase: new URL("https://evidence-graph.vercel.app"),
    title: {
      default: "Ailian | Evidence Graph",
      template: "%s | Ailian",
    },
    description: profile.summary[locale],
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <NextIntlClientProvider messages={messages}>
          <div className="site-shell">
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
          </div>
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
