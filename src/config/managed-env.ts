import { z } from "zod";

type EnvironmentSource = Record<string, string | undefined>;

const supabasePublicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const supabaseAdminSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const isConfigured = (value: string | undefined) => Boolean(value?.trim());

export const readManagedRuntimeStatus = (environment: EnvironmentSource) => ({
  supabasePublic: supabasePublicSchema.safeParse(environment).success,
  supabaseAdmin: supabaseAdminSchema.safeParse(environment).success,
  inngest:
    isConfigured(environment.INNGEST_EVENT_KEY) &&
    isConfigured(environment.INNGEST_SIGNING_KEY),
  sentry: isConfigured(environment.NEXT_PUBLIC_SENTRY_DSN),
});

export const requireSupabasePublicEnv = (environment: EnvironmentSource) => {
  const result = supabasePublicSchema.safeParse(environment);

  if (!result.success) {
    throw new Error("SUPABASE_PUBLIC_ENV_INVALID");
  }

  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
};

export const requireSupabaseAdminEnv = (environment: EnvironmentSource) => {
  const result = supabaseAdminSchema.safeParse(environment);

  if (!result.success) {
    throw new Error("SUPABASE_ADMIN_ENV_INVALID");
  }

  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
  };
};

export const requireProductionSmokeEnv = (environment: EnvironmentSource) => {
  if (environment.ALLOW_PRODUCTION_SMOKE !== "YES_I_ACCEPT_REAL_WRITES") {
    throw new Error("PRODUCTION_SMOKE_NOT_CONFIRMED");
  }

  try {
    const baseUrl = new URL(environment.PRODUCTION_BASE_URL ?? "");
    const hostname = baseUrl.hostname.toLowerCase();
    const isLocal =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.startsWith("127.") ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local");

    if (baseUrl.protocol !== "https:" || isLocal) {
      throw new Error("PRODUCTION_BASE_URL_INVALID");
    }

    return { baseUrl: baseUrl.origin };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PRODUCTION_BASE_URL_INVALID"
    ) {
      throw error;
    }

    throw new Error("PRODUCTION_BASE_URL_INVALID");
  }
};
