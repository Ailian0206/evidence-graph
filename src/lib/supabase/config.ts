import {
  readManagedRuntimeStatus,
  requireSupabasePublicEnv,
} from "@/config/managed-env";

const readPublicEnvironment = () => ({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export const isSupabasePublicConfigured = () =>
  readManagedRuntimeStatus(readPublicEnvironment()).supabasePublic;

export const getSupabasePublicConfig = () =>
  requireSupabasePublicEnv(readPublicEnvironment());
