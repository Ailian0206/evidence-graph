import { ArrowUpRight, Code2 } from "lucide-react";

import type { PortfolioProject } from "@/content/types";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export function ProjectRows({
  projects,
  locale,
  expanded = false,
}: {
  projects: PortfolioProject[];
  locale: AppLocale;
  expanded?: boolean;
}) {
  return (
    <div className="project-rows content-width">
      {projects.map((project, index) => (
        <article className="project-row" key={project.slug}>
          <div className="project-number">0{index + 1}</div>
          <div className="project-main">
            <header>
              <p>{project.statusLabel[locale]}</p>
              <h3>{project.name[locale]}</h3>
            </header>
            <p>{project.summary[locale]}</p>
            {expanded ? <p className="project-proof">{project.proof[locale]}</p> : null}
            <ul aria-label={locale === "zh" ? "技术栈" : "Technology stack"}>
              {project.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </div>
          <div className="project-links">
            <Link
              className="icon-action"
              href={`/work/${project.slug}`}
              aria-label={`${project.name[locale]} case study`}
            >
              <ArrowUpRight aria-hidden="true" size={19} />
            </Link>
            <a
              className="icon-action"
              href={project.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${project.name[locale]} GitHub`}
            >
              <Code2 aria-hidden="true" size={18} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
