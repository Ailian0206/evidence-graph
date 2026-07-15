import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProjectRows } from "@/components/portfolio/project-rows";
import { publicProjects } from "@/content/projects";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: locale === "zh" ? "精选作品" : "Work",
  };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Portfolio");

  return (
    <div className="public-page">
      <header className="page-intro content-width">
        <p className="section-index">01 / Work</p>
        <h1>{t("selectedWork")}</h1>
        <p>{t("selectedWorkDescription")}</p>
      </header>
      <ProjectRows projects={publicProjects} locale={locale} expanded />
    </div>
  );
}
