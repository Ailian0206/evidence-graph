import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProjectDashboard } from "@/components/projects/project-dashboard";
import { ManagedAppShell } from "@/components/projects/managed-app-shell";
import { requireManagedUser } from "@/features/auth/server-session";
import {
  createSupabaseProjectQueryAdapter,
  createSupabaseProjectRepository,
} from "@/features/projects/supabase-project-repository";
import type { AppLocale } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProjectDashboardPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({
  params,
}: ProjectDashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Projects.dashboard" });
  return { title: t("title") };
}

export default async function ProjectDashboardPage({
  params,
}: ProjectDashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireManagedUser({ locale, nextPath: `/${locale}/app` });
  const client = await createSupabaseServerClient();
  const store = createSupabaseProjectRepository({
    queries: createSupabaseProjectQueryAdapter(client),
  });
  const projects = await store.listProjects({ ownerId: user.id });

  return (
    <ManagedAppShell
      active="projects"
      locale={locale}
      user={{ displayName: user.displayName, email: user.email }}
    >
      <ProjectDashboard locale={locale} projects={projects} />
    </ManagedAppShell>
  );
}
