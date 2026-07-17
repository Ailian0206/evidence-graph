"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManagedUser } from "@/features/auth/server-session";
import {
  createResearchInputSchema,
  type CreateResearchInput,
} from "@/features/projects/project-store";
import {
  retryManagedResearchDispatch,
  submitManagedResearch,
} from "@/features/projects/research-submission";
import {
  createSupabaseProjectQueryAdapter,
  createSupabaseProjectRepository,
} from "@/features/projects/supabase-project-repository";
import type { AppLocale } from "@/i18n/routing";
import { sendResearchRequestedEvent } from "@/inngest/client";
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

const isRetryableResearchDispatch = async ({
  ownerId,
  projectId,
  runId,
}: {
  ownerId: string;
  projectId: string;
  runId: string;
}) => {
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("research_runs")
    .select("id")
    .eq("id", runId)
    .eq("owner_id", ownerId)
    .eq("project_id", projectId)
    .eq("status", "failed")
    .eq("error_message", "RESEARCH_DISPATCH_FAILED")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
};

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

  const result = await submitManagedResearch({
    locale,
    input: parsed.data,
    dependencies: {
      requireUser: requireManagedUser,
      createStore: createManagedProjectStore,
      sendEvent: sendResearchRequestedEvent,
    },
  });

  if (!result.ok) {
    return { status: "error", code: result.code };
  }

  revalidatePath(`/${locale}/app`);
  redirect(`/${locale}/app/research/${result.projectId}`);
}

export async function retryResearchDispatch(
  locale: AppLocale,
  projectId: string,
  runId: string,
) {
  const result = await retryManagedResearchDispatch({
    locale,
    projectId,
    runId,
    dependencies: {
      requireUser: requireManagedUser,
      isRetryable: isRetryableResearchDispatch,
      sendEvent: sendResearchRequestedEvent,
    },
  });

  if (result.ok) {
    revalidatePath(`/${locale}/app/research/${projectId}`);
  }

  return result;
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
