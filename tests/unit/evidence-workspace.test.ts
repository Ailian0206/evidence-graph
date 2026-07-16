import { describe, expect, it } from "vitest";

import {
  createEvidenceGraphElements,
  createWorkspaceClaimSummaries,
  filterWorkspaceClaims,
  reviewWorkspaceClaim,
} from "@/features/research/evidence-workspace";
import { createEvidenceWorkspaceFixture } from "@/features/research/evidence-workspace-fixture";

describe("evidence workspace fixture", () => {
  it("provides deterministic bilingual data for every evidence relation", () => {
    const first = createEvidenceWorkspaceFixture("zh");
    const second = createEvidenceWorkspaceFixture("zh");
    const english = createEvidenceWorkspaceFixture("en");

    expect(first).toEqual(second);
    expect(first.project.title).not.toBe(english.project.title);
    expect(new Set(first.evidenceLinks.map((link) => link.relation))).toEqual(
      new Set(["supports", "rebuts", "qualifies", "context"]),
    );
    expect(first.run.status).toBe("ready");
    expect(first.runLogs).toHaveLength(8);
  });
});

describe("evidence workspace claim summaries", () => {
  it("derives relation counts and filters by review status and relation", () => {
    const workspace = createEvidenceWorkspaceFixture("zh");
    const summaries = createWorkspaceClaimSummaries(workspace);
    const supportedClaim = summaries.find((summary) => summary.relationCounts.supports > 0);

    expect(supportedClaim?.evidenceLinks).not.toHaveLength(0);
    expect(
      filterWorkspaceClaims({
        claims: summaries,
        reviewStatus: "accepted",
        relations: ["supports", "rebuts", "qualifies", "context"],
      }).every((summary) => summary.claim.reviewStatus === "accepted"),
    ).toBe(true);
    expect(
      filterWorkspaceClaims({
        claims: summaries,
        reviewStatus: "all",
        relations: ["rebuts"],
      }),
    ).toEqual([
      expect.objectContaining({
        relationCounts: expect.objectContaining({ rebuts: 1 }),
      }),
    ]);
    expect(
      filterWorkspaceClaims({
        claims: summaries,
        reviewStatus: "all",
        relations: [],
      }),
    ).toEqual([]);
  });

  it("updates only the selected claim review status without mutating the input", () => {
    const workspace = createEvidenceWorkspaceFixture("zh");
    const originalClaims = structuredClone(workspace.claims);
    const targetClaim = workspace.claims[0];

    const reviewed = reviewWorkspaceClaim({
      claims: workspace.claims,
      claimId: targetClaim.id,
      reviewStatus: "accepted",
    });

    expect(workspace.claims).toEqual(originalClaims);
    expect(reviewed.find((claim) => claim.id === targetClaim.id)).toMatchObject({
      statement: targetClaim.statement,
      reviewStatus: "accepted",
    });
    expect(reviewed.filter((claim) => claim.id !== targetClaim.id)).toEqual(
      workspace.claims.filter((claim) => claim.id !== targetClaim.id),
    );
    expect(() =>
      reviewWorkspaceClaim({
        claims: workspace.claims,
        claimId: "claim_missing",
        reviewStatus: "rejected",
      }),
    ).toThrow("CLAIM_NOT_FOUND");
  });
});

describe("evidence workspace graph model", () => {
  it("creates stable unique elements for 200 claims regardless of label length", () => {
    const workspace = createEvidenceWorkspaceFixture("zh");
    const createClaims = (label: string) =>
      Array.from({ length: 200 }, (_, index) => ({
        ...workspace.claims[0],
        id: `claim_scale_${index}`,
        normalizedKey: `claim scale ${index}`,
        statement: `${label} ${index}`,
      }));
    const relations = ["supports", "rebuts", "qualifies", "context"] as const;
    const shortElements = createEvidenceGraphElements({
      ...workspace,
      claims: createClaims("Claim"),
      evidenceLinks: [],
      claimRelations: [],
      relations,
    });
    const longElements = createEvidenceGraphElements({
      ...workspace,
      claims: createClaims("A".repeat(600)),
      evidenceLinks: [],
      claimRelations: [],
      relations,
    });
    const claimNodes = longElements.filter(
      (element) => element.group === "nodes" && element.data.kind === "claim",
    );

    expect(claimNodes).toHaveLength(200);
    expect(new Set(longElements.map((element) => element.data.id)).size).toBe(
      longElements.length,
    );
    expect(longElements).toHaveLength(shortElements.length);
    expect(claimNodes[0].data.label).toHaveLength(602);
  });
});
