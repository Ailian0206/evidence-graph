import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { EvidenceWorkspace } from "@/components/evidence-workspace/evidence-workspace";
import { ManagedWorkspaceState } from "@/components/evidence-workspace/managed-workspace-state";
import { ManagedAppShell } from "@/components/projects/managed-app-shell";
import { requireManagedUser } from "@/features/auth/server-session";
import { createEvidenceWorkspaceFixture } from "@/features/research/evidence-workspace-fixture";
import {
  createManagedWorkspaceStore,
  createSupabaseManagedWorkspaceQueryAdapter,
} from "@/features/research/managed-workspace-store";
import type { AppLocale } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkspacePageProps = {
  params: Promise<{ locale: AppLocale; id: string }>;
};

export async function generateMetadata({
  params,
}: WorkspacePageProps): Promise<Metadata> {
  const { locale, id } = await params;

  if (id !== "demo") {
    return {};
  }

  return {
    title: createEvidenceWorkspaceFixture(locale).project.title,
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  if (id !== "demo") {
    const user = await requireManagedUser({
      locale,
      nextPath: `/${locale}/app/research/${id}`,
    });
    const client = await createSupabaseServerClient();
    const store = createManagedWorkspaceStore(
      createSupabaseManagedWorkspaceQueryAdapter(client),
    );
    const result = await store.load({ ownerId: user.id, projectId: id, locale });

    if (result.state === "not-found") {
      notFound();
    }

    const workspace =
      result.state === "ready" ? (
        <EvidenceWorkspace initialData={result.data} persistence="managed" />
      ) : (
        <ManagedWorkspaceState locale={locale} projectId={id} result={result} />
      );

    return (
      <ManagedAppShell
        active="projects"
        locale={locale}
        user={{ displayName: user.displayName, email: user.email }}
      >
        {workspace}
      </ManagedAppShell>
    );
  }

  const workspace = createEvidenceWorkspaceFixture(locale);

  return <EvidenceWorkspace initialData={workspace} />;
}
