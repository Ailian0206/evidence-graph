import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  isSupabasePublicConfigured,
} from "@/lib/supabase/config";

export const refreshSupabaseSession = async (
  request: NextRequest,
  response: NextResponse,
) => {
  if (!isSupabasePublicConfigured()) {
    return response;
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
};
