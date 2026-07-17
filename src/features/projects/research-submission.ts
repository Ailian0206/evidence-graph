import type {
  CreateResearchInput,
  ProjectStore,
} from "@/features/projects/project-store";
import type { AppLocale } from "@/i18n/routing";
import type { ResearchRequestedEventData } from "@/inngest/events";

type ResearchSubmissionDependencies = {
  requireUser: (input: {
    locale: AppLocale;
    nextPath: string;
  }) => Promise<{ id: string }>;
  createStore: () => Promise<ProjectStore>;
  sendEvent: (input: ResearchRequestedEventData) => Promise<unknown>;
};

export type ResearchSubmissionResult =
  | { ok: false; code: "MONTHLY_RUN_LIMIT_EXCEEDED" }
  | {
      ok: true;
      projectId: string;
      runId: string;
      dispatchFailed: boolean;
    };

export const submitManagedResearch = async ({
  locale,
  input,
  dependencies,
}: {
  locale: AppLocale;
  input: CreateResearchInput;
  dependencies: ResearchSubmissionDependencies;
}): Promise<ResearchSubmissionResult> => {
  const user = await dependencies.requireUser({
    locale,
    nextPath: `/${locale}/app/research/new`,
  });
  const store = await dependencies.createStore();

  let created;
  try {
    created = await store.createResearch({ ownerId: user.id, input });
  } catch (error) {
    if (error instanceof Error && error.message === "MONTHLY_RUN_LIMIT_EXCEEDED") {
      return { ok: false, code: "MONTHLY_RUN_LIMIT_EXCEEDED" };
    }

    throw error;
  }

  const event = {
    ownerId: user.id,
    projectId: created.project.id,
    runId: created.run.id,
  };

  try {
    await dependencies.sendEvent(event);
  } catch {
    await store.markResearchDispatchFailed(event);
    return {
      ok: true,
      projectId: event.projectId,
      runId: event.runId,
      dispatchFailed: true,
    };
  }

  return {
    ok: true,
    projectId: event.projectId,
    runId: event.runId,
    dispatchFailed: false,
  };
};
