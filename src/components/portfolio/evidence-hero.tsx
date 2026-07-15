import { ArrowDownRight, ArrowUpRight, Mail } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { profile } from "@/content/profile";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import { EvidenceCanvas } from "./evidence-canvas";

export async function EvidenceHero() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Portfolio");

  return (
    <section className="portfolio-hero">
      <EvidenceCanvas locale={locale} mode="hero" />
      <div className="hero-vignette" aria-hidden="true" />
      <div className="hero-content">
        <p className="hero-eyebrow">{t("eyebrow")}</p>
        <h1>{profile.brand}</h1>
        <p className="hero-role">{profile.role[locale]}</p>
        <p className="hero-summary">{profile.summary[locale]}</p>
        <div className="hero-actions">
          <Link className="primary-action" href="/evidence">
            Evidence Graph
            <ArrowUpRight aria-hidden="true" size={18} />
          </Link>
          <a className="secondary-action" href={`mailto:${profile.email}`}>
            <Mail aria-hidden="true" size={17} />
            {t("contact")}
          </a>
        </div>
      </div>
      <a className="hero-scroll" href="#selected-work">
        {t("selectedWork")}
        <ArrowDownRight aria-hidden="true" size={17} />
      </a>
    </section>
  );
}
