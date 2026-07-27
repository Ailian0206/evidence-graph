import { hasLocale } from "next-intl";
import { redirect } from "next/navigation";

import { getSafeAppPath } from "@/features/auth/session";
import { routing, type AppLocale } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale: AppLocale = hasLocale(routing.locales, localeParam)
    ? localeParam
    : routing.defaultLocale;
  const nextPath = getSafeAppPath(locale, url.searchParams.get("next") ?? undefined);
  const code = url.searchParams.get("code");
  let signedIn = false;

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      signedIn = !error;
    } catch {
      // The localized login page owns the configuration and retry state.
    }
  }

  if (signedIn) {
    redirect(nextPath);
  }

  const searchParams = new URLSearchParams({ next: nextPath, error: "oauth" });
  redirect(`/${locale}/auth/login?${searchParams.toString()}`);
}
