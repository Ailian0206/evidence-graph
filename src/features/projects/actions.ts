"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManagedUser } from "@/features/auth/server-session";
import {
  createResearchInputSchema,
  type CreateResearchInput,
} from "@/features/projects/project-store";
import {
  createSupabaseProjectQueryAdapter,
  createSupabaseProjectRepository,
} from "@/features/projects/supabase-project-repository";
import type { AppLocale } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateResearchFormState = {
  status: "idle" | "error";
  code?: "INVALID_INPUT" | "MONTHLY_RUN_LIMIT_EXCEEDED";
  fieldErrors?: Partial<Record<keyof CreateResearchInput, string[]>>;
};

const createManagedProjectStore = async () => {
  const client = await createSupabaseServerClient();
  return createSupabaseProjectRepository({
    queries: createSupabaseProjectQueryAdapter(client),
  });
};

const readResearchForm = (formData: FormData) =>
  createResearchInputSchema.safeParse({
    title: formData.get("title"),
    question: formData.get("question"),
    language: formData.get("language"),
    manualUrls: formData
      .getAll("manualUrls")
      .map(String)
      .map((url) => url.trim())
      .filter(Boolean),
  });

export async function createResearch(
  locale: AppLocale,
  _previousState: CreateResearchFormState,
  formData: FormData,
): Promise<CreateResearchFormState> {
  const parsed = readResearchForm(formData);

  if (!parsed.success) {
    return {
      status: "error",
      code: "INVALID_INPUT",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await requireManagedUser({
    locale,
    nextPath: `/${locale}/app/research/new`,
  });
  const store = await createManagedProjectStore();

  try {
    await store.createProject({ ownerId: user.id, input: parsed.data });
  } catch (error) {
    if (error instanceof Error && error.message === "MONTHLY_RUN_LIMIT_EXCEEDED") {
      return { status: "error", code: "MONTHLY_RUN_LIMIT_EXCEEDED" };
    }

    throw error;
  }

  revalidatePath(`/${locale}/app`);
  redirect(`/${locale}/app`);
}

export async function archiveProject(
  locale: AppLocale,
  projectId: string,
) {
  const user = await requireManagedUser({
    locale,
    nextPath: `/${locale}/app`,
  });
  const store = await createManagedProjectStore();
  await store.updateProject({
    ownerId: user.id,
    projectId,
    input: { status: "archived" },
  });
  revalidatePath(`/${locale}/app`);
}

export async function deleteProject(locale: AppLocale, projectId: string) {
  const user = await requireManagedUser({
    locale,
    nextPath: `/${locale}/app`,
  });
  const store = await createManagedProjectStore();
  await store.deleteProject({ ownerId: user.id, projectId });
  revalidatePath(`/${locale}/app`);
}
