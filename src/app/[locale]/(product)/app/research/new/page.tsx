import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { NewResearchForm } from "@/components/projects/new-research-form";
import { ManagedAppShell } from "@/components/projects/managed-app-shell";
import { requireManagedUser } from "@/features/auth/server-session";
import type { AppLocale } from "@/i18n/routing";

type NewResearchPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({
  params,
}: NewResearchPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Projects.form" });
  return { title: t("title") };
}

export default async function NewResearchPage({ params }: NewResearchPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireManagedUser({
    locale,
    nextPath: `/${locale}/app/research/new`,
  });

  return (
    <ManagedAppShell
      active="projects"
      locale={locale}
      user={{ displayName: user.displayName, email: user.email }}
    >
      <NewResearchForm locale={locale} />
    </ManagedAppShell>
  );
}
