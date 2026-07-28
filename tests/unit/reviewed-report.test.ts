import { describe, expect, it } from "vitest";

import {
  createReportReviewReadiness,
  createReviewedReportSnapshot,
} from "@/features/reports/reviewed-report";
import type { PublishableReport } from "@/features/reports/report-store";
import type { Claim } from "@/features/research/domain";
import type { ReportCitation } from "@/features/research/workflow-types";
import { createEvidenceWorkspaceFixture } from "@/features/research/evidence-workspace-fixture";

const workspace = createEvidenceWorkspaceFixture("en");

const createClaim = (
  id: string,
  reviewStatus: Claim["reviewStatus"],
): Claim => ({
  ...workspace.claims[0],
  id,
  normalizedKey: id,
  statement: id,
  reviewStatus,
});

const createCitation = (evidenceLinkId: string, claimId: string): ReportCitation => ({
  evidenceLinkId,
  claimId,
  chunkId: `chunk_${evidenceLinkId}`,
  sourceId: `source_${evidenceLinkId}`,
  quote: `Quote for ${evidenceLinkId}`,
  sourceUrl: `https://example.com/${evidenceLinkId}`,
  sourceTitle: `Source for ${evidenceLinkId}`,
});

const acceptedCitation = createCitation("link_accepted", "claim_accepted");
const rejectedCitation = createCitation("link_rejected", "claim_rejected");
const pendingCitation = createCitation("link_pending", "claim_pending");

const report: PublishableReport = {
  ...workspace.reports[0],
  id: "report_review_source",
  status: "draft",
  slug: undefined,
  publishedAt: undefined,
  markdown:
    "## Findings\n\nAccepted finding [link_accepted]\n\nRejected finding [link_rejected]\n\nMixed finding [link_accepted] [link_rejected]\n\n## Context\n\nMethod note [not-a-citation].",
  sections: [
    {
      id: "section_findings",
      heading: "Findings",
      factual: true,
      markdown:
        "Accepted finding [link_accepted]\n\nRejected finding [link_rejected]\n\nMixed finding [link_accepted] [link_rejected]",
      citationIds: ["link_accepted", "link_rejected"],
    },
    {
      id: "section_context",
      heading: "Context",
      factual: false,
      markdown: "Method note [not-a-citation].",
      citationIds: [],
    },
  ],
  citations: [acceptedCitation, rejectedCitation],
};

describe("report review readiness", () => {
  it("counts only pending and rejected claims referenced by the report", () => {
    const pendingReport = {
      ...report,
      citations: [...report.citations, pendingCitation],
    };

    expect(
      createReportReviewReadiness({
        report: pendingReport,
        claims: [
          createClaim("claim_accepted", "accepted"),
          createClaim("claim_rejected", "rejected"),
          createClaim("claim_pending", "pending"),
          createClaim("claim_unrelated", "pending"),
        ],
      }),
    ).toEqual({
      status: "incomplete",
      pendingClaimIds: ["claim_pending"],
      rejectedClaimIds: ["claim_rejected"],
    });
  });

  it("is ready when every referenced claim is reviewed", () => {
    expect(
      createReportReviewReadiness({
        report,
        claims: [
          createClaim("claim_accepted", "accepted"),
          createClaim("claim_rejected", "rejected"),
          createClaim("claim_unrelated", "pending"),
        ],
      }),
    ).toEqual({
      status: "ready",
      pendingClaimIds: [],
      rejectedClaimIds: ["claim_rejected"],
    });
  });
});

describe("reviewed report snapshots", () => {
  it("keeps accepted paragraphs and uncited context while dropping rejected paragraphs", () => {
    const reviewed = createReviewedReportSnapshot({
      report,
      claims: [
        createClaim("claim_accepted", "accepted"),
        createClaim("claim_rejected", "rejected"),
      ],
    });

    expect(reviewed).toEqual({
      markdown:
        "## Findings\n\nAccepted finding [link_accepted]\n\n## Context\n\nMethod note [not-a-citation].",
      sections: [
        {
          id: "section_findings",
          heading: "Findings",
          factual: true,
          markdown: "Accepted finding [link_accepted]",
          citationIds: ["link_accepted"],
        },
        {
          id: "section_context",
          heading: "Context",
          factual: false,
          markdown: "Method note [not-a-citation].",
          citationIds: [],
        },
      ],
      citations: [acceptedCitation],
    });
  });

  it("blocks derivation while a referenced claim is pending", () => {
    expect(() =>
      createReviewedReportSnapshot({
        report: {
          ...report,
          citations: [...report.citations, pendingCitation],
        },
        claims: [
          createClaim("claim_accepted", "accepted"),
          createClaim("claim_rejected", "rejected"),
          createClaim("claim_pending", "pending"),
        ],
      }),
    ).toThrow("REPORT_REVIEW_INCOMPLETE");
  });

  it("rejects a snapshot with no accepted factual paragraph", () => {
    expect(() =>
      createReviewedReportSnapshot({
        report: {
          ...report,
          sections: [
            {
              id: "section_rejected",
              heading: "Rejected",
              factual: true,
              markdown: "Rejected finding [link_rejected]",
              citationIds: ["link_rejected"],
            },
          ],
          citations: [rejectedCitation],
        },
        claims: [createClaim("claim_rejected", "rejected")],
      }),
    ).toThrow("REPORT_NO_ACCEPTED_CONTENT");
  });

  it("rejects factual paragraphs without a recognized persisted citation", () => {
    expect(() =>
      createReviewedReportSnapshot({
        report: {
          ...report,
          sections: [
            {
              id: "section_invalid",
              heading: "Invalid",
              factual: true,
              markdown: "Unsupported [not-a-citation]",
              citationIds: ["link_accepted"],
            },
          ],
          citations: [acceptedCitation],
        },
        claims: [createClaim("claim_accepted", "accepted")],
      }),
    ).toThrow("REPORT_NOT_PUBLISHABLE");
  });

  it("rejects a citation whose persisted claim is missing", () => {
    expect(() =>
      createReviewedReportSnapshot({
        report,
        claims: [createClaim("claim_accepted", "accepted")],
      }),
    ).toThrow("REPORT_NOT_PUBLISHABLE");
  });
});
