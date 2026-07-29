"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireManagedUser } from "@/features/auth/server-session";
import {
  accountLanguageSchema,
  createAccountSettingsStore,
  createSupabaseAccountSettingsQueryAdapter,
  deleteManagedAccount,
} from "@/features/settings/account-settings";
import type { AppLocale } from "@/i18n/routing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LanguagePreferenceState = {
  status: "idle" | "error";
  code?: "INVALID_LANGUAGE" | "LANGUAGE_UPDATE_FAILED";
};

export type DeleteAccountState = {
  status: "idle" | "error";
  code?:
    | "ACCOUNT_CONFIRMATION_MISMATCH"
    | "ACCOUNT_CONFIRMATION_UNAVAILABLE"
    | "ACCOUNT_DELETE_FAILED";
};

export async function saveLanguagePreference(
  locale: AppLocale,
  _previousState: LanguagePreferenceState,
  formData: FormData,
): Promise<LanguagePreferenceState> {
  const language = accountLanguageSchema.safeParse(formData.get("language"));

  if (!language.success) {
    return { status: "error", code: "INVALID_LANGUAGE" };
  }

  const user = await requireManagedUser({
    locale,
    nextPath: `/${locale}/app/settings`,
  });

  try {
    const client = await createSupabaseServerClient();
    const store = createAccountSettingsStore(
      createSupabaseAccountSettingsQueryAdapter(client),
    );
    await store.updateLanguage({ userId: user.id, language: language.data });
  } catch {
    return { status: "error", code: "LANGUAGE_UPDATE_FAILED" };
  }

  (await cookies()).set("NEXT_LOCALE", language.data, {
    path: "/",
    sameSite: "lax",
  });
  redirect(`/${language.data}/app/settings`);
}

export async function deleteAccount(
  locale: AppLocale,
  _previousState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await requireManagedUser({
    locale,
    nextPath: `/${locale}/app/settings`,
  });
  const confirmation = String(formData.get("confirmation") ?? "").slice(0, 320);

  try {
    const result = await deleteManagedAccount({
      user,
      confirmation,
      deleteUser: async (userId) => {
        const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(userId);

        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        const client = await createSupabaseServerClient();
        const { error } = await client.auth.signOut({ scope: "local" });

        if (error) {
          throw error;
        }
      },
    });

    if (!result.ok) {
      return { status: "error", code: result.code };
    }
  } catch {
    return { status: "error", code: "ACCOUNT_DELETE_FAILED" };
  }

  redirect(`/${locale}?account=deleted`);
}
