import type { Metadata } from "next";
import { ArrowLeft, Code2, Waypoints } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EvidenceCanvas } from "@/components/portfolio/evidence-canvas";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Evidence" });

  return {
    title: t("title"),
  };
}

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Evidence");

  return (
    <div className="evidence-preview public-page">
      <header className="evidence-preview-header content-width">
        <div>
          <p className="section-index">{t("previewLabel", { status: t("status") })}</p>
          <h1>{t("title")}</h1>
          <p>{t("description")}</p>
        </div>
        <div className="evidence-preview-actions">
          <Link className="primary-action" href="/app/research/demo">
            <Waypoints aria-hidden="true" size={17} />
            {t("openWorkspace")}
          </Link>
          <Link className="text-action" href="/">
            <ArrowLeft aria-hidden="true" size={17} />
            {locale === "zh" ? "返回作品集" : "Back to portfolio"}
          </Link>
          <a
            className="icon-action"
            href="https://github.com/Ailian0206/evidence-graph"
            target="_blank"
            rel="noreferrer"
            aria-label={locale === "zh" ? "查看 GitHub 仓库" : "View GitHub repository"}
          >
            <Code2 aria-hidden="true" size={19} />
          </a>
        </div>
      </header>
      <div className="content-width evidence-preview-canvas">
        <EvidenceCanvas locale={locale} mode="workspace" />
      </div>
      <p className="preview-caption content-width">{t("sample")}</p>
    </div>
  );
}
