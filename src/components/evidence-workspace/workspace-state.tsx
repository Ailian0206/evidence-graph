"use client";

import { Inbox, LoaderCircle, RotateCcw, SearchX, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import styles from "./evidence-workspace.module.css";

type WorkspaceStateName = "loading" | "failed" | "empty" | "not-found";

const stateIcons = {
  loading: LoaderCircle,
  failed: TriangleAlert,
  empty: Inbox,
  "not-found": SearchX,
};

const stateTranslationKeys = {
  loading: { title: "loadingTitle", description: "loadingDescription" },
  failed: { title: "errorTitle", description: "errorDescription" },
  empty: { title: "emptyTitle", description: "emptyDescription" },
  "not-found": { title: "notFoundTitle", description: "notFoundDescription" },
} as const;

export function WorkspaceState({
  state,
  onAction,
  actionHref,
}: {
  state: WorkspaceStateName;
  onAction?: () => void;
  actionHref?: "/evidence";
}) {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  const Icon = stateIcons[state];
  const copy = stateTranslationKeys[state];
  const actionLabel = state === "not-found" ? t("backToPreview") : t("retry");

  return (
    <section
      className={styles.workspaceState}
      data-testid="workspace-state"
      data-workspace-state={state}
      aria-live={state === "loading" ? "polite" : undefined}
    >
      <Icon aria-hidden="true" size={28} />
      <h1>{t(copy.title)}</h1>
      <p>{t(copy.description)}</p>
      {onAction && (
        <button className="primary-action" type="button" onClick={onAction}>
          <RotateCcw aria-hidden="true" size={17} />
          {actionLabel}
        </button>
      )}
      {actionHref && (
        <a className="primary-action" href={`/${locale}${actionHref}`}>
          {actionLabel}
        </a>
      )}
    </section>
  );
}
