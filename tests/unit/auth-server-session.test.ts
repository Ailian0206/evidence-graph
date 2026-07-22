import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({
  isSupabasePublicConfigured: () => true,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

import { getCurrentSupabaseUser } from "@/features/auth/server-session";

describe("Supabase server session", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
  });

  it("treats a missing Supabase session as an anonymous user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getCurrentSupabaseUser()).resolves.toBeNull();
  });
});
