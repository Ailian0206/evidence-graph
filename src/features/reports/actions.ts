"use server";

import { z } from "zod";

import {
  createReportStore,
  createSupabaseReportQueryAdapter,
} from "@/features/reports/report-store";
import type { AppLocale } from "@/i18n/routing";

type ReportStore = ReturnType<typeof createReportStore>;

type ReportActionDependencies = {
  requireUser: (input: {
    locale: AppLocale;
    nextPath: string;
  }) => Promise<{ id: string }>;
  createStore: () => Promise<ReportStore> | ReportStore;
  revalidate: (path: string) => void;
};

const reportActionInputSchema = z.object({
  locale: z.enum(["zh", "en"]),
  projectId: z.string().trim().min(1),
});

const publishReportInputSchema = reportActionInputSchema.extend({
  reportId: z.string().trim().min(1),
});

const reportActionErrorCodes = [
  "REPORT_NOT_FOUND",
  "REPORT_NOT_PUBLISHABLE",
  "PROJECT_NOT_PUBLISHABLE",
  "REPORT_QUERY_FAILED",
] as const;

const mapReportActionError = (error: unknown) => {
  if (error instanceof Error) {
    const stableCode = reportActionErrorCodes.find((code) => error.message.includes(code));
    if (stableCode) {
      return stableCode;
    }
  }

  return "REPORT_ACTION_FAILED" as const;
};

export async function publishManagedReport(
  input: { locale: AppLocale; projectId: string; reportId: string },
  dependencies: ReportActionDependencies,
) {
  const parsed = publishReportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, code: "INVALID_INPUT" as const };
  }

  const { locale, projectId, reportId } = parsed.data;
  const user = await dependencies.requireUser({
    locale,
    nextPath: `/${locale}/app/research/${projectId}`,
  });

  try {
    const store = await dependencies.createStore();
    const result = await store.publish({ ownerId: user.id, projectId, reportId });
    dependencies.revalidate(`/${locale}/app/research/${projectId}`);
    dependencies.revalidate(`/r/${result.slug}`);

    return {
      ok: true as const,
      slug: result.slug,
      version: result.version,
      publishedAt: result.publishedAt,
    };
  } catch (error) {
    return { ok: false as const, code: mapReportActionError(error) };
  }
}

export async function revokeManagedReport(
  input: { locale: AppLocale; projectId: string },
  dependencies: ReportActionDependencies,
) {
  const parsed = reportActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, code: "INVALID_INPUT" as const };
  }

  const { locale, projectId } = parsed.data;
  const user = await dependencies.requireUser({
    locale,
    nextPath: `/${locale}/app/research/${projectId}`,
  });

  try {
    const store = await dependencies.createStore();
    const result = await store.revoke({ ownerId: user.id, projectId });
    dependencies.revalidate(`/${locale}/app/research/${projectId}`);
    dependencies.revalidate(`/r/${result.slug}`);

    return { ok: true as const, slug: result.slug };
  } catch (error) {
    return { ok: false as const, code: mapReportActionError(error) };
  }
}

const createProductionDependencies = async (): Promise<ReportActionDependencies> => {
  const [{ revalidatePath }, { requireManagedUser }, { createSupabaseServerClient }] =
    await Promise.all([
      import("next/cache"),
      import("@/features/auth/server-session"),
      import("@/lib/supabase/server"),
    ]);

  return {
    requireUser: requireManagedUser,
    createStore: async () =>
      createReportStore(
        createSupabaseReportQueryAdapter(await createSupabaseServerClient()),
      ),
    revalidate: revalidatePath,
  };
};

export async function publishReport(
  locale: AppLocale,
  projectId: string,
  reportId: string,
) {
  return publishManagedReport(
    { locale, projectId, reportId },
    await createProductionDependencies(),
  );
}

export async function revokeReport(locale: AppLocale, projectId: string) {
  return revokeManagedReport(
    { locale, projectId },
    await createProductionDependencies(),
  );
}
