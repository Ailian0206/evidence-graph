"use client";

import { Code2, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { profile } from "@/content/profile";
import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export function SiteHeader() {
  const t = useTranslations("Navigation");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const alternateLocale: AppLocale = locale === "zh" ? "en" : "zh";

  return (
    <header className="site-header">
      <Link className="brand-link" href="/" aria-label={`${profile.brand} home`}>
        <span className="brand-mark" aria-hidden="true">
          A/
        </span>
        <span>{profile.brand}</span>
      </Link>
      <nav className="primary-nav" aria-label={locale === "zh" ? "主导航" : "Primary navigation"}>
        <Link href="/">{t("home")}</Link>
        <Link href="/work">{t("work")}</Link>
        <Link href="/notes">{t("notes")}</Link>
        <Link href="/evidence">{t("evidence")}</Link>
      </nav>
      <div className="header-actions">
        <Link
          className="icon-action"
          href={pathname}
          locale={alternateLocale}
          aria-label={t("language")}
          title={t("language")}
        >
          <Languages aria-hidden="true" size={18} />
        </Link>
        <a
          className="icon-action"
          href={profile.githubUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          title="GitHub"
        >
          <Code2 aria-hidden="true" size={18} />
        </a>
      </div>
    </header>
  );
}
