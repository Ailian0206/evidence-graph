import { describe, expect, it, vi } from "vitest";

import {
  createAccountSettingsStore,
  deleteManagedAccount,
  type AccountSettingsQueryAdapter,
  type AccountSettingsRow,
} from "@/features/settings/account-settings";

const profileRow: AccountSettingsRow = {
  id: "user_1",
  display_name: "Ailian",
  github_username: "Ailian0206",
  language: "zh",
  updated_at: "2026-07-29T00:00:00.000Z",
};

const createQueries = (
  overrides: Partial<AccountSettingsQueryAdapter> = {},
): AccountSettingsQueryAdapter => ({
  getProfile: vi.fn(async () => profileRow),
  updateLanguage: vi.fn(async () => ({ ...profileRow, language: "en" })),
  ...overrides,
});

describe("account settings", () => {
  it("reads and updates only the current user profile", async () => {
    const queries = createQueries();
    const store = createAccountSettingsStore(queries);

    await expect(store.getProfile({ userId: "user_1" })).resolves.toMatchObject({
      id: "user_1",
      language: "zh",
      githubUsername: "Ailian0206",
    });
    await expect(
      store.updateLanguage({ userId: "user_1", language: "en" }),
    ).resolves.toMatchObject({ language: "en" });

    expect(queries.getProfile).toHaveBeenCalledWith({ userId: "user_1" });
    expect(queries.updateLanguage).toHaveBeenCalledWith({
      userId: "user_1",
      language: "en",
    });
  });

  it("rejects an unsupported language before writing", async () => {
    const queries = createQueries();
    const store = createAccountSettingsStore(queries);

    await expect(
      store.updateLanguage({ userId: "user_1", language: "fr" as never }),
    ).rejects.toThrow();
    expect(queries.updateLanguage).not.toHaveBeenCalled();
  });

  it("maps a missing owned profile to ACCOUNT_PROFILE_NOT_FOUND", async () => {
    const store = createAccountSettingsStore(
      createQueries({ getProfile: vi.fn(async () => null) }),
    );

    await expect(store.getProfile({ userId: "user_2" })).rejects.toThrow(
      "ACCOUNT_PROFILE_NOT_FOUND",
    );
  });

  it("does not delete the account when the confirmation differs", async () => {
    const deleteUser = vi.fn(async () => undefined);
    const signOut = vi.fn(async () => undefined);

    await expect(
      deleteManagedAccount({
        user: { id: "user_1", displayName: "Ailian0206", email: "user@example.com" },
        confirmation: "Ailian",
        deleteUser,
        signOut,
      }),
    ).resolves.toEqual({ ok: false, code: "ACCOUNT_CONFIRMATION_MISMATCH" });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("hard deletes the current user before clearing the local session", async () => {
    const calls: string[] = [];

    await expect(
      deleteManagedAccount({
        user: { id: "user_1", displayName: "Ailian0206", email: "user@example.com" },
        confirmation: "Ailian0206",
        deleteUser: vi.fn(async (userId) => {
          calls.push(`delete:${userId}`);
        }),
        signOut: vi.fn(async () => {
          calls.push("signout");
        }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(calls).toEqual(["delete:user_1", "signout"]);
  });
});
