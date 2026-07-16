import { hasLocale } from "next-intl";
import { NextResponse } from "next/server";

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

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(new URL(nextPath, url.origin));
      }
    } catch {
      // The localized login page owns the configuration and retry state.
    }
  }

  const loginUrl = new URL(`/${locale}/auth/login`, url.origin);
  loginUrl.searchParams.set("next", nextPath);
  loginUrl.searchParams.set("error", "oauth");
  return NextResponse.redirect(loginUrl);
}
