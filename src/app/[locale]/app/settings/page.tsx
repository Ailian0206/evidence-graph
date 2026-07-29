import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ManagedAppShell } from "@/components/projects/managed-app-shell";
import { AccountSettings } from "@/components/settings/account-settings";
import { requireManagedUser } from "@/features/auth/server-session";
import {
  createAccountSettingsStore,
  createSupabaseAccountSettingsQueryAdapter,
} from "@/features/settings/account-settings";
import type { AppLocale } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SettingsPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({ params }: SettingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("title") };
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireManagedUser({
    locale,
    nextPath: `/${locale}/app/settings`,
  });
  const client = await createSupabaseServerClient();
  const store = createAccountSettingsStore(
    createSupabaseAccountSettingsQueryAdapter(client),
  );
  const profile = await store.getProfile({ userId: user.id });

  return (
    <ManagedAppShell
      active="settings"
      locale={locale}
      user={{ displayName: user.displayName, email: user.email }}
    >
      <AccountSettings
        locale={locale}
        profile={profile}
        user={{ displayName: user.displayName, email: user.email }}
      />
    </ManagedAppShell>
  );
}
