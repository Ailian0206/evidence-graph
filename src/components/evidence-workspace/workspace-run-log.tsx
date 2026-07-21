"use client";

import { Check, ChevronDown, TerminalSquare, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { ResearchRun } from "@/features/research/domain";
import type { RunLogEntry } from "@/features/research/workflow-types";
import type { AppLocale } from "@/i18n/routing";

import styles from "./evidence-workspace.module.css";

export function WorkspaceRunLog({
  locale,
  run,
  entries,
  mobileActive,
}: {
  locale: AppLocale;
  run: ResearchRun;
  entries: RunLogEntry[];
  mobileActive: boolean;
}) {
  const t = useTranslations("Workspace");
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      id="workspace-panel-log"
      className={styles.runLogPanel}
      role="tabpanel"
      aria-labelledby="workspace-tab-log"
      data-mobile-active={mobileActive}
    >
      <div className={styles.runLogBar}>
        <div>
          <TerminalSquare aria-hidden="true" size={17} />
          <span>
            <strong>{t("panels.log")}</strong>
            {t("runLog.completed", { count: entries.length })}
          </span>
        </div>
        <div className={styles.runLogSummary}>
          <span>{t("runLog.searches", { count: run.searchCount })}</span>
          <span>{t("runLog.tokens", { count: run.tokenCount })}</span>
          <span>{t("runLog.cost", { cost: run.estimatedCostUsd.toFixed(3) })}</span>
        </div>
        <button
          className={styles.runLogToggle}
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? t("runLog.collapse") : t("runLog.expand")}
          <ChevronDown aria-hidden="true" size={16} />
        </button>
      </div>
      {expanded && (
        <ol className={styles.runLogList} aria-label={t("runLog.stepsLabel")}>
          {entries.map((entry) => {
            const failed = entry.status === "failed";
            const StatusIcon = failed ? TriangleAlert : Check;

            return (
              <li key={entry.id} data-status={entry.status} data-run-log-entry>
                <StatusIcon aria-hidden="true" size={14} />
                <div>
                  <strong>{t(`steps.${entry.step}`)}</strong>
                  <span>
                    {t(`runLog.status.${entry.status}`)} · {t("runLog.attempt", { count: entry.attempt })}
                  </span>
                </div>
                <time dateTime={entry.timestamp}>
                  {new Intl.DateTimeFormat(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(new Date(entry.timestamp))}
                </time>
                {entry.errorCode && <code>{entry.errorCode}</code>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
