"use client";

import { ArrowUpRight, FileText, FolderOpen, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ManagedReportSummary } from "@/features/reports/report-list-store";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import styles from "./report-dashboard.module.css";

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

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{t("eyebrow")}</p>
            <h1>{t("title")}</h1>
            <p className={styles.description}>{t("description")}</p>
          </div>
          <Link className={styles.primaryAction} href="/app/research/new">
            <Plus aria-hidden="true" size={17} />
            {t("newResearch")}
          </Link>
        </header>

        {reports.length === 0 ? (
          <section className={styles.empty}>
            <FileText aria-hidden="true" size={24} />
            <h2>{t("empty.title")}</h2>
            <p>{t("empty.description")}</p>
          </section>
        ) : (
          <ul className={styles.list} aria-label={t("listLabel")}>
            {reports.map((report) => {
              const displayDate = report.publishedAt ?? report.createdAt;

              return (
                <li className={styles.row} key={report.id}>
                  <article>
                    <div className={styles.titleLine}>
                      <h2>{report.projectTitle}</h2>
                      <span className={styles.status} data-status={report.status}>
                        {t(`status.${report.status}`)}
                      </span>
                    </div>
                    <p className={styles.question}>{report.question}</p>
                    <div className={styles.metadata}>
                      <span>{t("version", { version: report.version })}</span>
                      <span>
                        {t(report.publishedAt ? "publishedAt" : "createdAt", {
                          date: dateFormatter.format(new Date(displayDate)),
                        })}
                      </span>
                      <span>{t(`language.${report.language}`)}</span>
                    </div>
                  </article>
                  <div className={styles.actions}>
                    <Link href={`/app/research/${report.projectId}`}>
                      <FolderOpen aria-hidden="true" size={16} />
                      {t("openResearch")}
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
          </ul>
        )}
      </div>
    </div>
  );
}
