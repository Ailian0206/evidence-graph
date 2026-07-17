"use server";

import { revalidatePath } from "next/cache";

import { requireManagedUser } from "@/features/auth/server-session";
import type { Claim } from "@/features/research/domain";
import {
  createSupabaseClaimReviewQuery,
  reviewManagedClaim,
} from "@/features/research/claim-review";
import type { AppLocale } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function reviewClaim(
  locale: AppLocale,
  projectId: string,
  claimId: string,
  reviewStatus: Claim["reviewStatus"],
) {
  const result = await reviewManagedClaim({
    locale,
    input: { projectId, claimId, reviewStatus },
    dependencies: {
      requireUser: requireManagedUser,
      updateClaim: async (input) => {
        const client = await createSupabaseServerClient();
        return createSupabaseClaimReviewQuery(client).updateClaim(input);
      },
    },
  });

  revalidatePath(`/${locale}/app/research/${projectId}`);
  return { ok: true as const, ...result };
}
