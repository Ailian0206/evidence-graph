"use client";

import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { retryResearchDispatch } from "@/features/projects/actions";
import type { ManagedWorkspaceResult } from "@/features/research/managed-workspace-store";
import type { AppLocale } from "@/i18n/routing";

import styles from "./evidence-workspace.module.css";

type PendingWorkspaceResult = Exclude<
  ManagedWorkspaceResult,
  { state: "ready" } | { state: "not-found" }
>;

export function ManagedWorkspaceState({
  locale,
  projectId,
  result,
}: {
  locale: AppLocale;
  projectId: string;
  result: PendingWorkspaceResult;
}) {
  const t = useTranslations("Workspace.managed");
  const router = useRouter();
  const [retrySent, setRetrySent] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryPending, startRetry] = useTransition();
  const visibleState = retrySent ? "queued" : result.state;
  const shouldPoll = visibleState === "queued" || visibleState === "running";
  const Icon = visibleState === "failed" ? TriangleAlert : LoaderCircle;

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const interval = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(interval);
  }, [router, shouldPoll]);

  const retry = () => {
    setRetryError(null);
    startRetry(async () => {
      const outcome = await retryResearchDispatch(locale, projectId, result.runId);
      if (outcome.ok) {
        setRetrySent(true);
        router.refresh();
        return;
      }

      setRetryError(outcome.code);
    });
  };

  const title =
    visibleState === "queued"
      ? t("queuedTitle")
      : visibleState === "running"
        ? t("runningTitle")
        : t("failedTitle");
  const description =
    visibleState === "queued"
      ? t(retrySent ? "retrySentDescription" : "queuedDescription")
      : visibleState === "running"
        ? t("runningDescription")
        : t("failedDescription");

  return (
    <section
      className={styles.workspaceState}
      data-testid="workspace-state"
      data-workspace-state={visibleState}
      aria-live={shouldPoll ? "polite" : undefined}
    >
      <Icon aria-hidden="true" size={28} />
      <h1>{title}</h1>
      <p>{description}</p>
      {visibleState === "failed" && result.state === "failed" && result.errorCode ? (
        <code className={styles.stateCode}>
          {t("errorCode", { code: result.errorCode })}
        </code>
      ) : null}
      {visibleState === "failed" &&
      result.state === "failed" &&
      result.canRetryDispatch ? (
        <button
          className="primary-action"
          type="button"
          onClick={retry}
          disabled={retryPending}
        >
          <RefreshCw aria-hidden="true" size={17} />
          {retryPending ? t("retrying") : t("retry")}
        </button>
      ) : null}
      {retryError ? (
        <p className={styles.stateError} role="alert">
          {t("retryError")}
        </p>
      ) : null}
    </section>
  );
}
