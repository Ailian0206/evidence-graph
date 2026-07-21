"use client";

import { Copy, ExternalLink, EyeOff, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { publishReport, revokeReport } from "@/features/reports/actions";
import type { PublishableReport } from "@/features/reports/report-store";
import type { ReportCitation } from "@/features/research/workflow-types";
import type { AppLocale } from "@/i18n/routing";

import styles from "./evidence-workspace.module.css";

type WorkspaceReportProps = {
  locale: AppLocale;
  projectId: string;
  reports: PublishableReport[];
  persistence: "demo" | "managed";
  onSelectCitation: (citation: ReportCitation) => void;
};

const renderSectionText = (markdown: string, citationIds: string[]) =>
  citationIds.reduce((text, citationId) => text.replaceAll(`[${citationId}]`, ""), markdown).trim();

export function WorkspaceReport({
  locale,
  projectId,
  reports: initialReports,
  persistence,
  onSelectCitation,
}: WorkspaceReportProps) {
  const t = useTranslations("Workspace.report");
  const [reports, setReports] = useState(initialReports);
  const [selectedReportId, setSelectedReportId] = useState(
    initialReports.find((report) => report.status === "published")?.id ??
      initialReports[0]?.id ??
      "",
  );
  const [actionError, setActionError] = useState<"publish" | "revoke" | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? reports[0];

  if (!selectedReport) {
    return (
      <div className={styles.reportEmpty} data-testid="workspace-report">
        <p>{t("empty")}</p>
      </div>
    );
  }

  const publicPath = selectedReport.slug ? `/r/${selectedReport.slug}` : undefined;
  const citationsById = new Map(
    selectedReport.citations.map((citation) => [citation.evidenceLinkId, citation]),
  );

  const handlePublish = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await publishReport(locale, projectId, selectedReport.id);
        if (!result.ok) {
          setActionError("publish");
          return;
        }

        setReports((currentReports) =>
          currentReports.map((report) => {
            if (report.id === selectedReport.id) {
              return {
                ...report,
                slug: result.slug,
                status: "published",
                publishedAt: result.publishedAt,
              };
            }

            if (report.status === "published") {
              return { ...report, slug: undefined, status: "revoked" };
            }

            return report;
          }),
        );
      } catch {
        setActionError("publish");
      }
    });
  };

  const handleRevoke = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await revokeReport(locale, projectId);
        if (!result.ok) {
          setActionError("revoke");
          return;
        }

        setReports((currentReports) =>
          currentReports.map((report) =>
            report.id === selectedReport.id
              ? { ...report, slug: undefined, status: "revoked" }
              : report,
          ),
        );
      } catch {
        setActionError("revoke");
      }
    });
  };

  const handleCopy = async () => {
    if (!publicPath) {
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error("CLIPBOARD_UNAVAILABLE");
      }
      await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).toString());
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className={styles.reportWorkspace} data-testid="workspace-report">
      <div className={styles.reportToolbar}>
        <label>
          <span>{t("versionLabel")}</span>
          <select
            value={selectedReport.id}
            onChange={(event) => {
              setSelectedReportId(event.target.value);
              setActionError(null);
              setCopyState("idle");
            }}
          >
            {reports.map((report) => (
              <option key={report.id} value={report.id}>
                {t("versionOption", { version: report.version })} - {t(`status.${report.status}`)}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.reportStatus} data-status={selectedReport.status} role="status">
          {t(`status.${selectedReport.status}`)}
        </span>
        <div className={styles.reportActions}>
          {persistence === "managed" && selectedReport.status !== "published" ? (
            <button type="button" onClick={handlePublish} disabled={isPending}>
              <Upload aria-hidden="true" size={15} />
              {isPending ? t("publishing") : t("publish")}
            </button>
          ) : null}
          {persistence === "managed" && selectedReport.status === "published" ? (
            <button type="button" onClick={handleRevoke} disabled={isPending}>
              <EyeOff aria-hidden="true" size={15} />
              {isPending ? t("revoking") : t("revoke")}
            </button>
          ) : null}
          {publicPath ? (
            <>
              <a
                className={styles.reportIconAction}
                href={publicPath}
                target="_blank"
                rel="noreferrer"
                aria-label={t("openPublic")}
                title={t("openPublic")}
              >
                <ExternalLink aria-hidden="true" size={15} />
              </a>
              <button
                className={styles.reportIconAction}
                type="button"
                onClick={handleCopy}
                aria-label={t("copy")}
                title={t("copy")}
              >
                <Copy aria-hidden="true" size={15} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {publicPath ? <code className={styles.reportPublicPath}>{publicPath}</code> : null}
      {copyState !== "idle" ? (
        <p className={styles.reportNotice} data-state={copyState} role="status">
          {t(copyState === "success" ? "copySuccess" : "copyError")}
        </p>
      ) : null}
      {actionError ? (
        <p className={styles.reportError} role="alert">
          {t(actionError === "publish" ? "publishError" : "revokeError")}
        </p>
      ) : null}

      <article className={styles.reportDocument}>
        {selectedReport.sections.map((section) => {
          const sectionCitations = section.citationIds
            .map((citationId) => citationsById.get(citationId))
            .filter((citation): citation is ReportCitation => Boolean(citation));

          return (
            <section key={section.id} className={styles.reportSection}>
              <h3>{section.heading}</h3>
              <p>{renderSectionText(section.markdown, section.citationIds)}</p>
              {sectionCitations.length > 0 ? (
                <div className={styles.reportCitations} aria-label={t("citationsLabel")}>
                  {sectionCitations.map((citation, index) => (
                    <button
                      key={citation.evidenceLinkId}
                      type="button"
                      aria-label={citation.sourceTitle}
                      onClick={() => onSelectCitation(citation)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{citation.sourceTitle}</strong>
                      <q>{citation.quote}</q>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </article>
    </div>
  );
}
