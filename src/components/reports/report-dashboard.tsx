"use client";

import { ArrowUpRight, FileText, FolderOpen } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ManagedReportSummary } from "@/features/reports/report-list-store";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import styles from "./report-dashboard.module.css";

type ReportProjectGroup = {
  projectId: string;
  projectTitle: string;
  question: string;
  reports: ManagedReportSummary[];
};

const reportTimestamp = (report: ManagedReportSummary) =>
  Date.parse(report.createdAt) || 0;

export const groupReportsByProject = (
  reports: ManagedReportSummary[],
): ReportProjectGroup[] => {
  const groups = new Map<string, ReportProjectGroup>();

  for (const report of reports) {
    const group = groups.get(report.projectId);

    if (group) {
      group.reports.push(report);
      continue;
    }

    groups.set(report.projectId, {
      projectId: report.projectId,
      projectTitle: report.projectTitle,
      question: report.question,
      reports: [report],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      reports: [...group.reports].sort(
        (left, right) =>
          right.version - left.version || reportTimestamp(right) - reportTimestamp(left),
      ),
    }))
    .sort(
      (left, right) =>
        Math.max(...right.reports.map(reportTimestamp)) -
        Math.max(...left.reports.map(reportTimestamp)),
    );
};

export function ReportDashboard({
  locale,
  reports,
}: {
  locale: AppLocale;
  reports: ManagedReportSummary[];
}) {
  const t = useTranslations("Reports");
  const dateFormatter = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
  });
  const reportGroups = groupReportsByProject(reports);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className={styles.description}>{t("description")}</p>
        </header>

        {reports.length === 0 ? (
          <section className={styles.empty}>
            <FileText aria-hidden="true" size={24} />
            <h2>{t("empty.title")}</h2>
            <p>{t("empty.description")}</p>
            <Link className={styles.emptyAction} href="/app">
              <FolderOpen aria-hidden="true" size={16} />
              {t("backToProjects")}
            </Link>
          </section>
        ) : (
          <ul className={styles.projectList} aria-label={t("projectListLabel")}>
            {reportGroups.map((group) => (
              <li className={styles.projectGroup} key={group.projectId}>
                <section aria-labelledby={`report-project-${group.projectId}`}>
                  <header className={styles.projectHeader}>
                    <div>
                      <h2 id={`report-project-${group.projectId}`}>{group.projectTitle}</h2>
                      <p className={styles.question}>{group.question}</p>
                    </div>
                    <Link href={`/app/research/${group.projectId}`}>
                      <FolderOpen aria-hidden="true" size={16} />
                      {t("backToResearch")}
                    </Link>
                  </header>
                  <ol
                    className={styles.versionList}
                    aria-label={t("versionListLabel", { title: group.projectTitle })}
                  >
                    {group.reports.map((report) => {
                      const displayDate = report.publishedAt ?? report.createdAt;

                      return (
                        <li className={styles.versionRow} key={report.id}>
                          <article>
                            <div className={styles.titleLine}>
                              <h3>{t("version", { version: report.version })}</h3>
                              <span className={styles.status} data-status={report.status}>
                                {t(`status.${report.status}`)}
                              </span>
                            </div>
                            <div className={styles.metadata}>
                              <span>
                                {t(report.publishedAt ? "publishedAt" : "createdAt", {
                                  date: dateFormatter.format(new Date(displayDate)),
                                })}
                              </span>
                              <span>{t(`language.${report.language}`)}</span>
                            </div>
                          </article>
                          <div className={styles.actions}>
                            <Link href={`/app/research/${report.projectId}?view=report`}>
                              <FileText aria-hidden="true" size={16} />
                              {t("openReport")}
                            </Link>
                            {report.status === "published" && report.slug ? (
                              <a href={`/r/${report.slug}`}>
                                <ArrowUpRight aria-hidden="true" size={16} />
                                {t("openPublic")}
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
