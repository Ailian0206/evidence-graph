import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAdminEnv } from "@/config/managed-env";

export const createSupabaseAdminClient = () => {
  const { url, serviceRoleKey } = requireSupabaseAdminEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
