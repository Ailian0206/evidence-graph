import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { projectLanguageSchema } from "@/features/projects/project-store";

export const accountLanguageSchema = projectLanguageSchema;

export type AccountSettingsRow = {
  id: string;
  display_name: string | null;
  github_username: string | null;
  language: "zh" | "en";
  updated_at: string;
};

const accountSettingsSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().nullable(),
  githubUsername: z.string().nullable(),
  language: accountLanguageSchema,
  updatedAt: z.iso.datetime(),
});

export type AccountSettings = z.infer<typeof accountSettingsSchema>;

export type AccountSettingsQueryAdapter = {
  getProfile: (input: { userId: string }) => Promise<AccountSettingsRow | null>;
  updateLanguage: (input: {
    userId: string;
    language: "zh" | "en";
  }) => Promise<AccountSettingsRow | null>;
};

const profileColumns = "id,display_name,github_username,language,updated_at";

const throwQueryError = (error: unknown) => {
  if (error) {
    throw error;
  }
};

export const createSupabaseAccountSettingsQueryAdapter = (
  client: SupabaseClient,
): AccountSettingsQueryAdapter => ({
  getProfile: async ({ userId }) => {
    const { data, error } = await client
      .from("profiles")
      .select(profileColumns)
      .eq("id", userId)
      .maybeSingle();
    throwQueryError(error);
    return data as AccountSettingsRow | null;
  },
  updateLanguage: async ({ userId, language }) => {
    const { data, error } = await client
      .from("profiles")
      .update({ language, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select(profileColumns)
      .maybeSingle();
    throwQueryError(error);
    return data as AccountSettingsRow | null;
  },
});

const mapProfile = (row: AccountSettingsRow): AccountSettings =>
  accountSettingsSchema.parse({
    id: row.id,
    displayName: row.display_name,
    githubUsername: row.github_username,
    language: row.language,
    updatedAt: new Date(row.updated_at).toISOString(),
  });

const requireProfile = (row: AccountSettingsRow | null) => {
  if (!row) {
    throw new Error("ACCOUNT_PROFILE_NOT_FOUND");
  }

  return row;
};

export const createAccountSettingsStore = (
  queries: AccountSettingsQueryAdapter,
) => ({
  getProfile: async ({ userId }: { userId: string }) =>
    mapProfile(requireProfile(await queries.getProfile({ userId }))),
  updateLanguage: async ({
    userId,
    language,
  }: {
    userId: string;
    language: "zh" | "en";
  }) => {
    const parsedLanguage = accountLanguageSchema.parse(language);
    return mapProfile(
      requireProfile(
        await queries.updateLanguage({ userId, language: parsedLanguage }),
      ),
    );
  },
});

type ManagedAccountUser = {
  id: string;
  displayName: string | null;
  email: string | null;
};

export const deleteManagedAccount = async ({
  user,
  confirmation,
  deleteUser,
  signOut,
}: {
  user: ManagedAccountUser;
  confirmation: string;
  deleteUser: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}) => {
  const expectedConfirmation = user.displayName?.trim() || user.email?.trim();

  if (!expectedConfirmation) {
    return { ok: false as const, code: "ACCOUNT_CONFIRMATION_UNAVAILABLE" as const };
  }

  if (confirmation.trim() !== expectedConfirmation) {
    return { ok: false as const, code: "ACCOUNT_CONFIRMATION_MISMATCH" as const };
  }

  await deleteUser(user.id);
  await signOut();
  return { ok: true as const };
};
