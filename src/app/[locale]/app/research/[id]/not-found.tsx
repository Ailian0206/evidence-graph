import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function WorkspaceNotFound() {
  const t = await getTranslations("Workspace");

  return (
    <section className="workspace-route-state" data-workspace-state="not-found">
      <h1>{t("notFoundTitle")}</h1>
      <p>{t("notFoundDescription")}</p>
      <Link className="text-action" href="/evidence">
        <ArrowLeft aria-hidden="true" size={17} />
        {t("backToPreview")}
      </Link>
    </section>
  );
}
