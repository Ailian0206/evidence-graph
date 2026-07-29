import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(async () => ({ client: true })),
  getProfile: vi.fn(async () => ({
    id: "user_1",
    displayName: "Ailian",
    githubUsername: "Ailian0206",
    language: "zh" as const,
    updatedAt: "2026-07-29T00:00:00.000Z",
  })),
  requireManagedUser: vi.fn(async () => ({
    id: "user_1",
    email: "user@example.com",
    displayName: "Ailian0206",
  })),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
  setRequestLocale: vi.fn(),
}));
vi.mock("@/components/projects/managed-app-shell", () => ({
  ManagedAppShell: () => null,
}));
vi.mock("@/components/settings/account-settings", () => ({
  AccountSettings: () => null,
}));
vi.mock("@/features/auth/server-session", () => ({
  requireManagedUser: mocks.requireManagedUser,
}));
vi.mock("@/features/settings/account-settings", () => ({
  createAccountSettingsStore: () => ({ getProfile: mocks.getProfile }),
  createSupabaseAccountSettingsQueryAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import SettingsPage from "@/app/[locale]/app/settings/page";
import { ManagedAppShell } from "@/components/projects/managed-app-shell";

describe("managed settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the owned profile inside the active settings shell", async () => {
    const page = await SettingsPage({
      params: Promise.resolve({ locale: "zh" }),
    });

    expect(mocks.requireManagedUser).toHaveBeenCalledWith({
      locale: "zh",
      nextPath: "/zh/app/settings",
    });
    expect(mocks.getProfile).toHaveBeenCalledWith({ userId: "user_1" });
    expect(page.type).toBe(ManagedAppShell);
    expect(page.props).toMatchObject({
      active: "settings",
      locale: "zh",
      user: { displayName: "Ailian0206", email: "user@example.com" },
    });
    expect(page.props.children.props).toMatchObject({
      locale: "zh",
      user: { displayName: "Ailian0206", email: "user@example.com" },
      profile: { id: "user_1", language: "zh" },
    });
  });
});
