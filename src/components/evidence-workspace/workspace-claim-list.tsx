import { Check, Clock3, RotateCcw, Undo2, X } from "lucide-react";

import type { WorkspaceClaimSummary } from "@/features/research/evidence-workspace";

import styles from "./evidence-workspace.module.css";

const statusIcons = {
  accepted: Check,
  pending: Clock3,
  rejected: X,
};

export function WorkspaceClaimList({
  claims,
  selectedClaimId,
  statusLabels,
  evidenceLabel,
  emptyLabel,
  reviewComplete,
  reviewErrorClaimId,
  reviewLabels,
  reviewNotice,
  reviewPending,
  onSelect,
  onReview,
  onUndo,
}: {
  claims: WorkspaceClaimSummary[];
  selectedClaimId: string;
  statusLabels: Record<WorkspaceClaimSummary["claim"]["reviewStatus"], string>;
  evidenceLabel: (count: number) => string;
  emptyLabel: string;
  reviewComplete: boolean;
  reviewErrorClaimId: string | null;
  reviewLabels: {
    accept: string;
    reject: string;
    reset: string;
    saving: string;
    resultLabel: string;
    accepted: string;
    rejected: string;
    undo: string;
    complete: string;
    error: string;
  };
  reviewNotice: { reviewStatus: "accepted" | "rejected" } | null;
  reviewPending: boolean;
  onSelect: (claimId: string) => void;
  onReview: (
    claimId: string,
    reviewStatus: "pending" | "accepted" | "rejected",
  ) => void;
  onUndo: () => void;
}) {
  if (claims.length === 0) {
    return <p className={styles.emptyList}>{emptyLabel}</p>;
  }

  return (
    <ul className={styles.claimList}>
      {claims.map((summary) => {
        const StatusIcon = statusIcons[summary.claim.reviewStatus];
        const selected = summary.claim.id === selectedClaimId;

        return (
          <li id={`workspace-claim-${summary.claim.id}`} key={summary.claim.id}>
            <article
              className={styles.claimCard}
              aria-label={summary.claim.statement}
              data-selected={selected}
            >
              <button
                className={styles.claimRow}
                type="button"
                aria-label={summary.claim.statement}
                aria-pressed={selected}
                onClick={() => onSelect(summary.claim.id)}
              >
                <span className={styles.claimRowMeta}>
                  <span data-status={summary.claim.reviewStatus}>
                    <StatusIcon aria-hidden="true" size={13} />
                    {statusLabels[summary.claim.reviewStatus]}
                  </span>
                  <span>{Math.round(summary.claim.confidence * 100)}%</span>
                </span>
                <strong>{summary.claim.statement}</strong>
                <span className={styles.claimEvidenceCount}>
                  {evidenceLabel(summary.evidenceLinks.length)}
                </span>
                <span className={styles.relationSummary} aria-hidden="true">
                  {summary.relationCounts.supports > 0 && (
                    <i data-relation="supports">{summary.relationCounts.supports}</i>
                  )}
                  {summary.relationCounts.rebuts > 0 && (
                    <i data-relation="rebuts">{summary.relationCounts.rebuts}</i>
                  )}
                  {summary.relationCounts.qualifies > 0 && (
                    <i data-relation="qualifies">{summary.relationCounts.qualifies}</i>
                  )}
                  {summary.relationCounts.context > 0 && (
                    <i data-relation="context">{summary.relationCounts.context}</i>
                  )}
                </span>
              </button>
              {selected ? (
                <div className={styles.claimReview}>
                  {reviewNotice ? (
                    <div className={styles.reviewNotice}>
                      <span role="status" aria-label={reviewLabels.resultLabel}>
                        {reviewNotice.reviewStatus === "accepted"
                          ? reviewLabels.accepted
                          : reviewLabels.rejected}
                      </span>
                      <button type="button" onClick={onUndo} disabled={reviewPending}>
                        <Undo2 aria-hidden="true" size={15} />
                        {reviewLabels.undo}
                      </button>
                    </div>
                  ) : null}
                  {reviewComplete ? (
                    <p className={styles.reviewComplete} role="status">
                      {reviewLabels.complete}
                    </p>
                  ) : null}
                  <div className={styles.reviewActions}>
                    {summary.claim.reviewStatus === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onReview(summary.claim.id, "accepted")}
                          disabled={reviewPending}
                        >
                          <Check aria-hidden="true" size={16} />
                          {reviewLabels.accept}
                        </button>
                        <button
                          type="button"
                          onClick={() => onReview(summary.claim.id, "rejected")}
                          disabled={reviewPending}
                        >
                          <X aria-hidden="true" size={16} />
                          {reviewLabels.reject}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onReview(summary.claim.id, "pending")}
                        disabled={reviewPending}
                      >
                        <RotateCcw aria-hidden="true" size={15} />
                        {reviewLabels.reset}
                      </button>
                    )}
                  </div>
                  {reviewPending ? (
                    <span className={styles.reviewSaving} role="status">
                      {reviewLabels.saving}
                    </span>
                  ) : null}
                  {reviewErrorClaimId === summary.claim.id ? (
                    <p className={styles.reviewError} role="alert">
                      {reviewLabels.error}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
