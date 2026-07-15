import type { Metadata } from "next";
import { ArrowUpRight, Code2 } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { getProjectBySlug, publicProjects } from "@/content/projects";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type ProjectPageProps = {
  params: Promise<{ locale: AppLocale; slug: string }>;
};

export function generateStaticParams() {
  return publicProjects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = getProjectBySlug(slug);

  return project
    ? { title: project.name[locale], description: project.summary[locale] }
    : {};
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  return (
    <article className="case-study public-page">
      <header className="case-hero content-width">
        <div>
          <p className="section-index">Case study / {project.statusLabel[locale]}</p>
          <h1>{project.name[locale]}</h1>
        </div>
        <p className="case-summary">{project.summary[locale]}</p>
      </header>

      <div className="case-body content-width">
        <section>
          <p className="section-index">01 / Problem</p>
          <h2>{locale === "zh" ? "问题" : "Problem"}</h2>
          <p>{project.problem[locale]}</p>
        </section>
        <section>
          <p className="section-index">02 / Approach</p>
          <h2>{locale === "zh" ? "方法" : "Approach"}</h2>
          <p>{project.approach[locale]}</p>
        </section>
        <section>
          <p className="section-index">03 / Proof</p>
          <h2>{locale === "zh" ? "当前结果" : "Current proof"}</h2>
          <p>{project.proof[locale]}</p>
        </section>
      </div>

      <footer className="case-actions content-width">
        {project.slug === "evidence-graph" ? (
          <Link className="text-action" href="/evidence">
            {locale === "zh" ? "进入产品" : "Open product"}
            <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        ) : null}
        <a
          className="text-action"
          href={project.repositoryUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Code2 aria-hidden="true" size={17} />
          {locale === "zh" ? "查看源码" : "View repository"}
        </a>
      </footer>
    </article>
  );
}
