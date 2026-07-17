import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseClaimReviewQuery,
  reviewManagedClaim,
} from "@/features/research/claim-review";

describe("managed claim review", () => {
  it("authorizes before updating the claim within its project", async () => {
    const calls: string[] = [];
    const updateClaim = vi.fn(async () => {
      calls.push("update");
      return true;
    });

    await expect(
      reviewManagedClaim({
        locale: "zh",
        input: {
          projectId: "project_1",
          claimId: "claim_1",
          reviewStatus: "accepted",
        },
        dependencies: {
          requireUser: async () => {
            calls.push("authorize");
            return { id: "owner_1" };
          },
          updateClaim,
        },
      }),
    ).resolves.toEqual({
      projectId: "project_1",
      claimId: "claim_1",
      reviewStatus: "accepted",
    });
    expect(calls).toEqual(["authorize", "update"]);
    expect(updateClaim).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
      claimId: "claim_1",
      reviewStatus: "accepted",
    });
  });

  it("rejects an invalid review status before writing", async () => {
    const updateClaim = vi.fn();

    await expect(
      reviewManagedClaim({
        locale: "en",
        input: {
          projectId: "project_1",
          claimId: "claim_1",
          reviewStatus: "deleted",
        },
        dependencies: {
          requireUser: async () => ({ id: "owner_1" }),
          updateClaim,
        },
      }),
    ).rejects.toThrow();
    expect(updateClaim).not.toHaveBeenCalled();
  });

  it("does not expose whether a missing or foreign claim exists", async () => {
    await expect(
      reviewManagedClaim({
        locale: "zh",
        input: {
          projectId: "project_1",
          claimId: "claim_other",
          reviewStatus: "rejected",
        },
        dependencies: {
          requireUser: async () => ({ id: "owner_1" }),
          updateClaim: async () => false,
        },
      }),
    ).rejects.toThrow("CLAIM_NOT_FOUND");
  });

  it("scopes the RLS update to both claim and project identifiers", async () => {
    const filters: Array<[string, string]> = [];
    const builder = {
      update: vi.fn(() => builder),
      eq: vi.fn((column: string, value: string) => {
        filters.push([column, value]);
        return builder;
      }),
      select: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: { id: "claim_1" }, error: null })),
    };
    const client = {
      from: vi.fn(() => builder),
    } as unknown as SupabaseClient;
    const query = createSupabaseClaimReviewQuery(client);

    await expect(
      query.updateClaim({
        ownerId: "owner_1",
        projectId: "project_1",
        claimId: "claim_1",
        reviewStatus: "rejected",
      }),
    ).resolves.toBe(true);
    expect(client.from).toHaveBeenCalledWith("claims");
    expect(builder.update).toHaveBeenCalledWith({ review_status: "rejected" });
    expect(filters).toEqual([
      ["id", "claim_1"],
      ["project_id", "project_1"],
    ]);
  });
});
