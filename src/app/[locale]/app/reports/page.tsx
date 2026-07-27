import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ManagedAppShell } from "@/components/projects/managed-app-shell";
import { ReportDashboard } from "@/components/reports/report-dashboard";
import { requireManagedUser } from "@/features/auth/server-session";
import {
  createManagedReportListStore,
  createSupabaseReportListQueryAdapter,
} from "@/features/reports/report-list-store";
import type { AppLocale } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReportListPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({ params }: ReportListPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Reports" });
  return { title: t("title") };
}

export default async function ReportListPage({ params }: ReportListPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireManagedUser({
    locale,
    nextPath: `/${locale}/app/reports`,
  });
  const client = await createSupabaseServerClient();
  const store = createManagedReportListStore(createSupabaseReportListQueryAdapter(client));
  const reports = await store.list({ ownerId: user.id });

  return (
    <ManagedAppShell
      active="reports"
      locale={locale}
      user={{ displayName: user.displayName, email: user.email }}
    >
      <ReportDashboard locale={locale} reports={reports} />
    </ManagedAppShell>
  );
}
