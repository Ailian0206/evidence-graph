import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  deleteManagedAccount: vi.fn(),
  deleteUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireManagedUser: vi.fn(),
  signOut: vi.fn(),
  updateLanguage: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mocks.cookieSet })),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/auth/server-session", () => ({
  requireManagedUser: mocks.requireManagedUser,
}));
vi.mock("@/features/settings/account-settings", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/settings/account-settings")
  >();

  return {
    ...actual,
    createAccountSettingsStore: () => ({ updateLanguage: mocks.updateLanguage }),
    createSupabaseAccountSettingsQueryAdapter: vi.fn(() => ({})),
    deleteManagedAccount: mocks.deleteManagedAccount,
  };
});
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: { deleteUser: mocks.deleteUser } },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signOut: mocks.signOut },
  })),
}));

import {
  deleteAccount,
  saveLanguagePreference,
} from "@/features/settings/actions";

describe("account settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManagedUser.mockResolvedValue({
      id: "user_1",
      displayName: "Ailian0206",
      email: "user@example.com",
    });
    mocks.updateLanguage.mockResolvedValue({ id: "user_1", language: "en" });
    mocks.deleteManagedAccount.mockResolvedValue({ ok: true });
    mocks.deleteUser.mockResolvedValue({ data: {}, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("rejects an unsupported language without loading the session", async () => {
    const formData = new FormData();
    formData.set("language", "fr");

    await expect(
      saveLanguagePreference("zh", { status: "idle" }, formData),
    ).resolves.toEqual({ status: "error", code: "INVALID_LANGUAGE" });
    expect(mocks.requireManagedUser).not.toHaveBeenCalled();
  });

  it("persists the language cookie and redirects to the selected locale", async () => {
    const formData = new FormData();
    formData.set("language", "en");

    await expect(
      saveLanguagePreference("zh", { status: "idle" }, formData),
    ).rejects.toThrow("REDIRECT:/en/app/settings");

    expect(mocks.updateLanguage).toHaveBeenCalledWith({
      userId: "user_1",
      language: "en",
    });
    expect(mocks.cookieSet).toHaveBeenCalledWith("NEXT_LOCALE", "en", {
      path: "/",
      sameSite: "lax",
    });
  });

  it("returns the confirmation mismatch without invoking Admin deletion", async () => {
    mocks.deleteManagedAccount.mockResolvedValue({
      ok: false,
      code: "ACCOUNT_CONFIRMATION_MISMATCH",
    });
    const formData = new FormData();
    formData.set("confirmation", "wrong");

    await expect(deleteAccount("zh", { status: "idle" }, formData)).resolves.toEqual({
      status: "error",
      code: "ACCOUNT_CONFIRMATION_MISMATCH",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("deletes the current account and redirects to the localized home", async () => {
    const formData = new FormData();
    formData.set("confirmation", "Ailian0206");

    await expect(deleteAccount("zh", { status: "idle" }, formData)).rejects.toThrow(
      "REDIRECT:/zh?account=deleted",
    );

    expect(mocks.deleteManagedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: "user_1" }),
        confirmation: "Ailian0206",
      }),
    );
  });
});
