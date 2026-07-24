"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSafeAppPath } from "@/features/auth/session";
import type { AppLocale } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const signInWithGitHub = async (
  locale: AppLocale,
  requestedNextPath: string,
) => {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (!origin) {
    throw new Error("REQUEST_ORIGIN_MISSING");
  }

  const nextPath = getSafeAppPath(locale, requestedNextPath);
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("locale", locale);
  callbackUrl.searchParams.set("next", nextPath);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error || !data.url) {
    throw error ?? new Error("GITHUB_OAUTH_URL_MISSING");
  }

  redirect(data.url);
};

export const signOut = async (locale: AppLocale) => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  redirect(`/${locale}`);
};
