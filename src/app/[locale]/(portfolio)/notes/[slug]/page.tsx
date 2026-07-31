import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, CalendarDays, Database, TriangleAlert } from "lucide-react";
import NextLink from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { EvidenceCanvas } from "@/components/portfolio/evidence-canvas";
import {
  getPublicResearchCase,
  publicResearchCases,
} from "@/content/public-research-cases";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type PublicResearchCasePageProps = {
  params: Promise<{ locale: AppLocale; slug: string }>;
};

const pageCopy = {
  zh: {
    back: "返回研究案例",
    caseLabel: "公开研究案例",
    question: "研究问题",
    scope: "研究范围",
    decision: "决策",
    limitations: "限制",
    failure: "失败与修正",
    failureLabel: "最初的问题",
    correctionLabel: "如何修正",
    report: "打开引用报告",
    graph: "证据到决策",
    article: "研究记录",
    sources: "{count} 个公开来源",
  },
  en: {
    back: "Back to research cases",
    caseLabel: "Public research case",
    question: "Research question",
    scope: "Research scope",
    decision: "Decision",
    limitations: "Limitations",
    failure: "Failure and correction",
    failureLabel: "What failed first",
    correctionLabel: "How it was corrected",
    report: "Open cited report",
    graph: "Evidence to decision",
    article: "Research record",
    sources: "{count} public sources",
  },
} as const;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return publicResearchCases.map((researchCase) => ({ slug: researchCase.slug }));
}

export async function generateMetadata({
  params,
}: PublicResearchCasePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const researchCase = getPublicResearchCase(slug);

  return researchCase
    ? {
        title: researchCase.title[locale],
        description: researchCase.summary[locale],
      }
    : {};
}

export default async function PublicResearchCasePage({
  params,
}: PublicResearchCasePageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const researchCase = getPublicResearchCase(slug);

  if (!researchCase) {
    notFound();
  }

  const copy = pageCopy[locale];

  return (
    <article className="research-case public-page">
      <header className="research-case-hero content-width">
        <Link className="text-action research-case-back" href="/notes">
          <ArrowLeft aria-hidden="true" size={17} />
          {copy.back}
        </Link>
        <p className="section-index">{copy.caseLabel}</p>
        <h1>{researchCase.title[locale]}</h1>
        <p>{researchCase.summary[locale]}</p>
        <dl>
          <div>
            <dt>
              <CalendarDays aria-hidden="true" size={15} />
              {researchCase.researchedAt}
            </dt>
          </div>
          <div>
            <dt>
              <Database aria-hidden="true" size={15} />
              {copy.sources.replace("{count}", String(researchCase.sourceCount))}
            </dt>
          </div>
        </dl>
      </header>

      <section className="research-case-question content-width">
        <div>
          <p className="section-index">{copy.question}</p>
          <h2>{researchCase.question[locale]}</h2>
        </div>
        <div>
          <p className="section-index">{copy.scope}</p>
          <p>{researchCase.scope[locale]}</p>
        </div>
      </section>

      <section className="research-case-graph content-width" aria-labelledby="case-graph-title">
        <header>
          <p className="section-index">01</p>
          <h2 id="case-graph-title">{copy.graph}</h2>
        </header>
        <EvidenceCanvas
          locale={locale}
          mode="workspace"
          graph={researchCase.graph}
          query={researchCase.question[locale]}
        />
      </section>

      <div className="research-case-content content-width">
        <aside className="research-case-decision">
          <section>
            <p className="section-index">{copy.decision}</p>
            <h2>{researchCase.decision[locale]}</h2>
          </section>
          <section>
            <p className="section-index">{copy.limitations}</p>
            <ul>
              {researchCase.limitations.map((limitation) => (
                <li key={limitation.en}>{limitation[locale]}</li>
              ))}
            </ul>
          </section>
          <NextLink className="primary-action" href={`/r/${researchCase.reportSlug}`}>
            {copy.report}
            <ArrowUpRight aria-hidden="true" size={17} />
          </NextLink>
        </aside>

        <div className="research-case-article">
          <header>
            <p className="section-index">02</p>
            <h2>{copy.article}</h2>
          </header>
          {researchCase.article.map((section) => (
            <section key={section.heading.en}>
              <h3>{section.heading[locale]}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.en}>{paragraph[locale]}</p>
              ))}
            </section>
          ))}

          <section className="research-case-failure">
            <header>
              <TriangleAlert aria-hidden="true" size={19} />
              <h3>{copy.failure}</h3>
            </header>
            <div>
              <strong>{copy.failureLabel}</strong>
              <p>{researchCase.failure.what[locale]}</p>
            </div>
            <div>
              <strong>{copy.correctionLabel}</strong>
              <p>{researchCase.failure.correction[locale]}</p>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
