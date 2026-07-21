import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  claimReviewStatusSchema,
  type Claim,
} from "@/features/research/domain";
import type { AppLocale } from "@/i18n/routing";

export const reviewManagedClaimInputSchema = z.object({
  projectId: z.string().min(1),
  claimId: z.string().min(1),
  reviewStatus: claimReviewStatusSchema,
});

export type ClaimReviewUpdate = z.infer<typeof reviewManagedClaimInputSchema> & {
  ownerId: string;
};

export type ClaimReviewQuery = {
  updateClaim: (input: ClaimReviewUpdate) => Promise<boolean>;
};

type ClaimReviewDependencies = {
  requireUser: (input: {
    locale: AppLocale;
    nextPath: string;
  }) => Promise<{ id: string }>;
  updateClaim: ClaimReviewQuery["updateClaim"];
};

export const createSupabaseClaimReviewQuery = (
  client: SupabaseClient,
): ClaimReviewQuery => ({
  updateClaim: async ({ projectId, claimId, reviewStatus }) => {
    const { data, error } = await client
      .from("claims")
      .update({ review_status: reviewStatus })
      .eq("id", claimId)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  },
});

export const reviewManagedClaim = async ({
  locale,
  input,
  dependencies,
}: {
  locale: AppLocale;
  input: {
    projectId: unknown;
    claimId: unknown;
    reviewStatus: unknown;
  };
  dependencies: ClaimReviewDependencies;
}): Promise<{
  projectId: string;
  claimId: string;
  reviewStatus: Claim["reviewStatus"];
}> => {
  const parsed = reviewManagedClaimInputSchema.parse(input);
  const user = await dependencies.requireUser({
    locale,
    nextPath: `/${locale}/app/research/${parsed.projectId}`,
  });
  const updated = await dependencies.updateClaim({
    ownerId: user.id,
    ...parsed,
  });

  if (!updated) {
    throw new Error("CLAIM_NOT_FOUND");
  }

  return parsed;
};
