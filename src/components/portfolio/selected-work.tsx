import { getLocale, getTranslations } from "next-intl/server";

import { publicProjects } from "@/content/projects";
import type { AppLocale } from "@/i18n/routing";

import { ProjectRows } from "./project-rows";

export async function SelectedWork() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Portfolio");

  return (
    <section className="portfolio-section selected-work" id="selected-work">
      <header className="section-heading content-width">
        <p className="section-index">01 / Work</p>
        <div>
          <h2>{t("selectedWork")}</h2>
          <p>{t("selectedWorkDescription")}</p>
        </div>
      </header>
      <ProjectRows projects={publicProjects} locale={locale} />
    </section>
  );
}
