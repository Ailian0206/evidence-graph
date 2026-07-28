import type { PublishableReport } from "@/features/reports/report-store";
import type { Claim } from "@/features/research/domain";

export type ReportReviewClaim = Pick<Claim, "id" | "reviewStatus">;

export type ReportReviewReadiness = {
  status: "incomplete" | "ready";
  pendingClaimIds: string[];
  rejectedClaimIds: string[];
};

export type ReviewedReportSnapshot = Pick<
  PublishableReport,
  "markdown" | "sections" | "citations"
>;

const requireReferencedClaims = ({
  report,
  claims,
}: {
  report: PublishableReport;
  claims: ReportReviewClaim[];
}) => {
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));

  return Array.from(new Set(report.citations.map((citation) => citation.claimId))).map(
    (claimId) => {
      const claim = claimById.get(claimId);

      if (!claim) {
        throw new Error("REPORT_NOT_PUBLISHABLE");
      }

      return claim;
    },
  );
};

export const createReportReviewReadiness = ({
  report,
  claims,
}: {
  report: PublishableReport;
  claims: ReportReviewClaim[];
}): ReportReviewReadiness => {
  const referencedClaims = requireReferencedClaims({ report, claims });
  const pendingClaimIds = referencedClaims
    .filter((claim) => claim.reviewStatus === "pending")
    .map((claim) => claim.id);
  const rejectedClaimIds = referencedClaims
    .filter((claim) => claim.reviewStatus === "rejected")
    .map((claim) => claim.id);

  return {
    status: pendingClaimIds.length > 0 ? "incomplete" : "ready",
    pendingClaimIds,
    rejectedClaimIds,
  };
};

const splitParagraphs = (markdown: string) =>
  markdown
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export const createReviewedReportSnapshot = ({
  report,
  claims,
}: {
  report: PublishableReport;
  claims: ReportReviewClaim[];
}): ReviewedReportSnapshot => {
  const readiness = createReportReviewReadiness({ report, claims });

  if (readiness.status === "incomplete") {
    throw new Error("REPORT_REVIEW_INCOMPLETE");
  }

  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const citationById = new Map(
    report.citations.map((citation) => [citation.evidenceLinkId, citation]),
  );
  let acceptedFactualParagraphs = 0;
  const sections = report.sections.flatMap((section) => {
    const keptParagraphs = splitParagraphs(section.markdown).flatMap((paragraph) => {
      const citationIds = section.citationIds.filter((citationId) =>
        paragraph.includes(`[${citationId}]`),
      );

      if (citationIds.length === 0) {
        if (section.factual) {
          throw new Error("REPORT_NOT_PUBLISHABLE");
        }

        return [{ markdown: paragraph, citationIds }];
      }

      const paragraphClaims = citationIds.map((citationId) => {
        const citation = citationById.get(citationId);
        const claim = citation ? claimById.get(citation.claimId) : undefined;

        if (!citation || !claim) {
          throw new Error("REPORT_NOT_PUBLISHABLE");
        }

        return claim;
      });

      if (paragraphClaims.some((claim) => claim.reviewStatus === "rejected")) {
        return [];
      }

      if (!paragraphClaims.every((claim) => claim.reviewStatus === "accepted")) {
        throw new Error("REPORT_REVIEW_INCOMPLETE");
      }

      if (section.factual) {
        acceptedFactualParagraphs += 1;
      }

      return [{ markdown: paragraph, citationIds }];
    });

    if (keptParagraphs.length === 0) {
      return [];
    }

    return [
      {
        ...section,
        markdown: keptParagraphs.map((paragraph) => paragraph.markdown).join("\n\n"),
        citationIds: Array.from(
          new Set(keptParagraphs.flatMap((paragraph) => paragraph.citationIds)),
        ),
      },
    ];
  });

  if (acceptedFactualParagraphs === 0) {
    throw new Error("REPORT_NO_ACCEPTED_CONTENT");
  }

  const includedCitationIds = new Set(
    sections.flatMap((section) => section.citationIds),
  );
  const citations = report.citations.filter((citation) =>
    includedCitationIds.has(citation.evidenceLinkId),
  );

  return {
    markdown: sections
      .map((section) => `## ${section.heading}\n\n${section.markdown}`)
      .join("\n\n"),
    sections,
    citations,
  };
};
