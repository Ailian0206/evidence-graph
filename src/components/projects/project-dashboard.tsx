"use client";

import { Archive, Clock3, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

import {
  archiveProject,
  deleteProject,
} from "@/features/projects/actions";
import type { ManagedProject } from "@/features/projects/project-store";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import styles from "./project-workspace.module.css";

function ProjectActionButton({
  label,
  icon,
}: {
  label: string;
  icon: "archive" | "delete";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={styles.iconButton}
      type="submit"
      aria-label={label}
      title={label}
      disabled={pending}
    >
      {icon === "archive" ? (
        <Archive aria-hidden="true" size={17} />
      ) : (
        <Trash2 aria-hidden="true" size={17} />
      )}
    </button>
  );
}

export function ProjectDashboard({
  locale,
  projects,
}: {
  locale: AppLocale;
  projects: ManagedProject[];
}) {
  const t = useTranslations("Projects");
  const dateFormatter = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
  });

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{t("dashboard.eyebrow")}</p>
            <h1>{t("dashboard.title")}</h1>
            <p className={styles.description}>{t("dashboard.description")}</p>
          </div>
          <Link className={styles.primaryAction} href="/app/research/new">
            <Plus aria-hidden="true" size={17} />
            {t("newResearch")}
          </Link>
        </header>

        {projects.length === 0 ? (
          <section className={styles.empty}>
            <h2>{t("empty.title")}</h2>
            <p>{t("empty.description")}</p>
          </section>
        ) : (
          <ul className={styles.projectList} aria-label={t("projectListLabel")}>
            {projects.map((project) => {
              const archiveAction = archiveProject.bind(null, locale, project.id);
              const deleteAction = deleteProject.bind(null, locale, project.id);

              return (
                <li key={project.id} className={styles.projectRow}>
                  <article>
                    <div className={styles.projectTitleLine}>
                      <h2>{project.title}</h2>
                      <span className={styles.status} data-status={project.status}>
                        {t(`status.${project.status}`)}
                      </span>
                    </div>
                    <p className={styles.question}>{project.question}</p>
                    <div className={styles.metadata}>
                      <span>
                        <Clock3 aria-hidden="true" size={14} />
                        {t("updated", {
                          date: dateFormatter.format(new Date(project.updatedAt)),
                        })}
                      </span>
                      <span>{t(`language.${project.language}`)}</span>
                    </div>
                  </article>
                  <div className={styles.projectActions}>
                    {project.status === "active" ? (
                      <form action={archiveAction}>
                        <ProjectActionButton
                          icon="archive"
                          label={t("archive", { title: project.title })}
                        />
                      </form>
                    ) : null}
                    <form
                      action={deleteAction}
                      onSubmit={(event) => {
                        if (!window.confirm(t("deleteConfirm", { title: project.title }))) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <ProjectActionButton
                        icon="delete"
                        label={t("delete", { title: project.title })}
                      />
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
