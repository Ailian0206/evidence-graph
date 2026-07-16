import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { createEvidenceWorkspaceFixture } from "@/features/research/evidence-workspace-fixture";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type WorkspacePageProps = {
  params: Promise<{ locale: AppLocale; id: string }>;
};

export function generateStaticParams() {
  return [{ id: "demo" }];
}

export async function generateMetadata({
  params,
}: WorkspacePageProps): Promise<Metadata> {
  const { locale, id } = await params;

  if (id !== "demo") {
    return {};
  }

  return {
    title: createEvidenceWorkspaceFixture(locale).project.title,
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  if (id !== "demo") {
    notFound();
  }

  const workspace = createEvidenceWorkspaceFixture(locale);
  const t = await getTranslations("Workspace");

  return (
    <section className="workspace-route" data-workspace-state="ready">
      <header className="workspace-route-header content-width">
        <div>
          <p className="section-index">{t("eyebrow")}</p>
          <h1>{workspace.project.title}</h1>
          <p>{workspace.project.question}</p>
        </div>
        <Link className="text-action" href="/evidence">
          <ArrowLeft aria-hidden="true" size={17} />
          {t("backToPreview")}
        </Link>
      </header>
      <dl className="workspace-route-metrics content-width" aria-label={t("runSummary")}>
        <div>
          <dt>{t("claims")}</dt>
          <dd>{workspace.claims.length}</dd>
        </div>
        <div>
          <dt>{t("sources")}</dt>
          <dd>{workspace.sources.length}</dd>
        </div>
        <div>
          <dt>{t("searches")}</dt>
          <dd>{workspace.run.searchCount}</dd>
        </div>
        <div>
          <dt>{t("estimatedCost")}</dt>
          <dd>${workspace.run.estimatedCostUsd.toFixed(3)}</dd>
        </div>
      </dl>
    </section>
  );
}
