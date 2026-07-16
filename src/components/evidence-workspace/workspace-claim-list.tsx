import { Check, Clock3, X } from "lucide-react";

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
  onSelect,
}: {
  claims: WorkspaceClaimSummary[];
  selectedClaimId: string;
  statusLabels: Record<WorkspaceClaimSummary["claim"]["reviewStatus"], string>;
  evidenceLabel: (count: number) => string;
  emptyLabel: string;
  onSelect: (claimId: string) => void;
}) {
  if (claims.length === 0) {
    return <p className={styles.emptyList}>{emptyLabel}</p>;
  }

  return (
    <ul className={styles.claimList}>
      {claims.map((summary) => {
        const StatusIcon = statusIcons[summary.claim.reviewStatus];

        return (
          <li key={summary.claim.id}>
            <button
              className={styles.claimRow}
              type="button"
              aria-label={summary.claim.statement}
              aria-pressed={summary.claim.id === selectedClaimId}
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
          </li>
        );
      })}
    </ul>
  );
}
