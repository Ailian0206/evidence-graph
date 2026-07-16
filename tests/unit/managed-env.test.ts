import { describe, expect, it } from "vitest";

import {
  readManagedRuntimeStatus,
  requireProductionSmokeEnv,
  requireSupabaseAdminEnv,
  requireSupabasePublicEnv,
} from "@/config/managed-env";

describe("managed runtime environment", () => {
  it("keeps managed capabilities disabled when no variables are configured", () => {
    expect(readManagedRuntimeStatus({})).toEqual({
      supabasePublic: false,
      supabaseAdmin: false,
      inngest: false,
      sentry: false,
    });
  });

  it("requires the public Supabase variables as a pair", () => {
    expect(() =>
      requireSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      }),
    ).toThrow("SUPABASE_PUBLIC_ENV_INVALID");

    expect(
      requireSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("requires the service role only for the admin environment", () => {
    const publicEnv = {
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    };

    expect(() => requireSupabaseAdminEnv(publicEnv)).toThrow(
      "SUPABASE_ADMIN_ENV_INVALID",
    );
    expect(
      requireSupabaseAdminEnv({
        ...publicEnv,
        SUPABASE_SERVICE_ROLE_KEY: "service_role_test",
      }),
    ).toEqual({
      url: "https://project.supabase.co",
      serviceRoleKey: "service_role_test",
    });
  });

  it("requires explicit confirmation before production smoke requests", () => {
    expect(() =>
      requireProductionSmokeEnv({
        ALLOW_PRODUCTION_SMOKE: "wrong",
        PRODUCTION_BASE_URL: "https://evidence.example.com",
      }),
    ).toThrow("PRODUCTION_SMOKE_NOT_CONFIRMED");

    expect(() =>
      requireProductionSmokeEnv({
        ALLOW_PRODUCTION_SMOKE: "YES_I_ACCEPT_REAL_WRITES",
        PRODUCTION_BASE_URL: "http://localhost:3000",
      }),
    ).toThrow("PRODUCTION_BASE_URL_INVALID");

    expect(
      requireProductionSmokeEnv({
        ALLOW_PRODUCTION_SMOKE: "YES_I_ACCEPT_REAL_WRITES",
        PRODUCTION_BASE_URL: "https://evidence.example.com/path",
      }),
    ).toEqual({ baseUrl: "https://evidence.example.com" });
  });
});
