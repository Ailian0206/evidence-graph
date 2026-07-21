import { ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { profile } from "@/content/profile";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const locale = (await getLocale()) as AppLocale;
  const alternateLocale: AppLocale = locale === "zh" ? "en" : "zh";

  return (
    <footer className="site-footer">
      <p>{t("statement")}</p>
      <div>
        <a href={`mailto:${profile.email}`}>
          {profile.email}
          <ArrowUpRight aria-hidden="true" size={15} />
        </a>
        <a href={profile.githubUrl} target="_blank" rel="noreferrer">
          GitHub
          <ArrowUpRight aria-hidden="true" size={15} />
        </a>
        <Link href="/" locale={alternateLocale}>
          {t("language")}
        </Link>
      </div>
    </footer>
  );
}
