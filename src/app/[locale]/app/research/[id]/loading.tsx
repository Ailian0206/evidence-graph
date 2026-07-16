"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export default function WorkspaceLoading() {
  const t = useTranslations("Workspace");

  return (
    <section className="workspace-route-state" data-workspace-state="loading">
      <LoaderCircle aria-hidden="true" size={24} />
      <h1>{t("loadingTitle")}</h1>
      <p>{t("loadingDescription")}</p>
    </section>
  );
}
