"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

export default function WorkspaceError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("Workspace");

  return (
    <section className="workspace-route-state" data-workspace-state="failed">
      <h1>{t("errorTitle")}</h1>
      <p>{t("errorDescription")}</p>
      <button className="primary-action" type="button" onClick={unstable_retry}>
        <RotateCcw aria-hidden="true" size={17} />
        {t("retry")}
      </button>
    </section>
  );
}
