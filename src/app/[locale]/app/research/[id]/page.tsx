import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { EvidenceWorkspace } from "@/components/evidence-workspace/evidence-workspace";
import { requireManagedUser } from "@/features/auth/server-session";
import { createEvidenceWorkspaceFixture } from "@/features/research/evidence-workspace-fixture";
import type { AppLocale } from "@/i18n/routing";

type WorkspacePageProps = {
  params: Promise<{ locale: AppLocale; id: string }>;
};

export function generateStaticParams() {
  return [{ id: "demo" }];
}

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
    await requireManagedUser({
      locale,
      nextPath: `/${locale}/app/research/${id}`,
    });
    notFound();
  }

  const workspace = createEvidenceWorkspaceFixture(locale);

  return <EvidenceWorkspace initialData={workspace} />;
}
