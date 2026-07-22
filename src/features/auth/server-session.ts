import "server-only";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/session";
import type { AppLocale } from "@/i18n/routing";
import { isSupabasePublicConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCurrentSupabaseUser = async () => {
  if (!isSupabasePublicConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (isAuthSessionMissingError(error)) {
    return null;
  }

  if (error) {
    throw error;
  }

  return data.user;
};

export const requireManagedUser = ({
  locale,
  nextPath,
}: {
  locale: AppLocale;
  nextPath?: string;
}) =>
  requireUser({
    locale,
    nextPath,
    getUser: getCurrentSupabaseUser,
    redirectTo: redirect,
  });
