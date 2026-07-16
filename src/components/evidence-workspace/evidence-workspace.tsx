"use client";

import {
  Check,
  CircleDot,
  ExternalLink,
  FileText,
  Network,
  RotateCcw,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  createEvidenceGraphElements,
  createWorkspaceClaimSummaries,
  filterWorkspaceClaims,
  reviewWorkspaceClaim,
  workspaceEvidenceRelations,
  type ClaimReviewFilter,
  type EvidenceWorkspaceData,
} from "@/features/research/evidence-workspace";

import styles from "./evidence-workspace.module.css";
import { WorkspaceClaimList } from "./workspace-claim-list";

const reviewFilters: ClaimReviewFilter[] = [
  "all",
  "pending",
  "accepted",
  "rejected",
];

export function EvidenceWorkspace({ initialData }: { initialData: EvidenceWorkspaceData }) {
  const t = useTranslations("Workspace");
  const [claims, setClaims] = useState(initialData.claims);
  const [reviewFilter, setReviewFilter] = useState<ClaimReviewFilter>("all");
  const [activeRelations, setActiveRelations] = useState(
    new Set(initialData.evidenceLinks.map((link) => link.relation)),
  );
  const [selectedClaimId, setSelectedClaimId] = useState(initialData.claims[0]?.id ?? "");
  const workspace = useMemo(() => ({ ...initialData, claims }), [claims, initialData]);
  const claimSummaries = useMemo(
    () => createWorkspaceClaimSummaries(workspace),
    [workspace],
  );
  const visibleClaims = useMemo(
    () =>
      filterWorkspaceClaims({
        claims: claimSummaries,
        reviewStatus: reviewFilter,
        relations: workspaceEvidenceRelations.filter((relation) =>
          activeRelations.has(relation),
        ),
      }),
    [activeRelations, claimSummaries, reviewFilter],
  );
  const graphElements = useMemo(
    () =>
      createEvidenceGraphElements({
        ...workspace,
        relations: workspaceEvidenceRelations.filter((relation) =>
          activeRelations.has(relation),
        ),
      }),
    [activeRelations, workspace],
  );
  const selectedSummary =
    claimSummaries.find(({ claim }) => claim.id === selectedClaimId) ?? claimSummaries[0];
  const selectedClaim = selectedSummary?.claim;
  const selectedEvidence = selectedSummary?.evidenceLinks.find((link) =>
    activeRelations.has(link.relation),
  );
  const selectedChunk = selectedEvidence
    ? workspace.chunks.find((chunk) => chunk.id === selectedEvidence.chunkId)
    : undefined;
  const selectedSource = selectedChunk
    ? workspace.sources.find((source) => source.id === selectedChunk.sourceId)
    : undefined;
  const statusLabels = {
    pending: t("status.pending"),
    accepted: t("status.accepted"),
    rejected: t("status.rejected"),
  };
  const handleReview = (reviewStatus: "pending" | "accepted" | "rejected") => {
    if (!selectedClaim) {
      return;
    }

    setClaims((currentClaims) =>
      reviewWorkspaceClaim({
        claims: currentClaims,
        claimId: selectedClaim.id,
        reviewStatus,
      }),
    );
  };
  const toggleRelation = (relation: (typeof workspaceEvidenceRelations)[number]) => {
    setActiveRelations((current) => {
      const next = new Set(current);

      if (next.has(relation)) {
        next.delete(relation);
      } else {
        next.add(relation);
      }

      return next;
    });
  };

  return (
    <section
      className={styles.workspace}
      data-workspace-state="ready"
      data-visible-claims={visibleClaims.length}
    >
      <header className={styles.projectBar}>
        <div className={styles.projectIdentity}>
          <span className={styles.runIndicator}>
            <CircleDot aria-hidden="true" size={15} />
            {t("run.ready")}
          </span>
          <div>
            <p>{t("eyebrow")}</p>
            <h1>{workspace.project.title}</h1>
            <span>{workspace.project.question}</span>
          </div>
        </div>
        <dl className={styles.runMetrics} aria-label={t("runSummary")}>
          <div>
            <dt>{t("claims")}</dt>
            <dd>{workspace.claims.length}</dd>
          </div>
          <div>
            <dt>{t("sources")}</dt>
            <dd>{workspace.sources.length}</dd>
          </div>
          <div>
            <dt>{t("searches")}</dt>
            <dd>{workspace.run.searchCount}</dd>
          </div>
          <div>
            <dt>{t("tokens")}</dt>
            <dd>{workspace.run.tokenCount.toLocaleString(workspace.locale)}</dd>
          </div>
          <div>
            <dt>{t("estimatedCost")}</dt>
            <dd>${workspace.run.estimatedCostUsd.toFixed(3)}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.workspaceGrid}>
        <section className={`${styles.panel} ${styles.claimPanel}`} aria-labelledby="claims-title">
          <header className={styles.panelHeader}>
            <div>
              <p>{t("panels.claims")}</p>
              <h2 id="claims-title">{t("claimCount", { count: visibleClaims.length })}</h2>
            </div>
          </header>
          <div className={styles.segmented} role="group" aria-label={t("reviewFilter")}>
            {reviewFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={reviewFilter === filter}
                onClick={() => setReviewFilter(filter)}
              >
                {t(`status.${filter}`)}
              </button>
            ))}
          </div>
          <WorkspaceClaimList
            claims={visibleClaims}
            selectedClaimId={selectedClaim?.id ?? ""}
            statusLabels={statusLabels}
            evidenceLabel={(count) => t("evidenceCount", { count })}
            emptyLabel={t("emptyClaims")}
            onSelect={setSelectedClaimId}
          />
          {selectedClaim && (
            <div className={styles.reviewDock} data-testid="selected-claim">
              <div>
                <span
                  className={styles.currentStatus}
                  role="status"
                  aria-label={t("currentStatus")}
                  data-status={selectedClaim.reviewStatus}
                >
                  {statusLabels[selectedClaim.reviewStatus]}
                </span>
                <p>{selectedClaim.statement}</p>
              </div>
              <div className={styles.reviewActions}>
                <button type="button" onClick={() => handleReview("accepted")}>
                  <Check aria-hidden="true" size={16} />
                  {t("actions.accept")}
                </button>
                <button type="button" onClick={() => handleReview("rejected")}>
                  <X aria-hidden="true" size={16} />
                  {t("actions.reject")}
                </button>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-label={t("actions.reset")}
                  title={t("actions.reset")}
                  onClick={() => handleReview("pending")}
                >
                  <RotateCcw aria-hidden="true" size={15} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={`${styles.panel} ${styles.graphPanel}`} aria-labelledby="graph-title">
          <header className={styles.panelHeader}>
            <div>
              <p>{t("panels.graph")}</p>
              <h2 id="graph-title">{t("graphTitle")}</h2>
            </div>
            <Network aria-hidden="true" size={19} />
          </header>
          <fieldset className={styles.relationFilters}>
            <legend>{t("relationFilter")}</legend>
            {workspaceEvidenceRelations.map((relation) => (
              <label key={relation} data-relation={relation}>
                <input
                  type="checkbox"
                  checked={activeRelations.has(relation)}
                  onChange={() => toggleRelation(relation)}
                />
                <span aria-hidden="true" />
                {t(`relation.${relation}`)}
              </label>
            ))}
          </fieldset>
          <div className={styles.graphCanvas} data-graph-elements={graphElements.length}>
            <div className={styles.graphPlaceholder}>
              <Network aria-hidden="true" size={34} />
              <strong>{t("graphPreparing")}</strong>
              <span>{t("graphElementCount", { count: graphElements.length })}</span>
            </div>
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.sourcePanel}`} aria-labelledby="source-title">
          <header className={styles.panelHeader}>
            <div>
              <p>{t("panels.source")}</p>
              <h2 id="source-title">{selectedSource?.domain ?? t("noSource")}</h2>
            </div>
            <FileText aria-hidden="true" size={19} />
          </header>
          {selectedEvidence && selectedSource ? (
            <div className={styles.sourceBody}>
              <span className={styles.relationBadge} data-relation={selectedEvidence.relation}>
                {t(`relation.${selectedEvidence.relation}`)} · {t(`strength.${selectedEvidence.strength}`)}
              </span>
              <blockquote>{selectedEvidence.quote}</blockquote>
              <p>{selectedEvidence.rationale}</p>
              <dl>
                <div>
                  <dt>{t("sourceMeta.title")}</dt>
                  <dd>{selectedSource.title}</dd>
                </div>
                <div>
                  <dt>{t("sourceMeta.author")}</dt>
                  <dd>{selectedSource.author ?? t("sourceMeta.unknown")}</dd>
                </div>
                <div>
                  <dt>{t("sourceMeta.retrieved")}</dt>
                  <dd>
                    {new Intl.DateTimeFormat(workspace.locale, {
                      dateStyle: "medium",
                    }).format(new Date(selectedSource.retrievedAt))}
                  </dd>
                </div>
                <div>
                  <dt>{t("sourceMeta.url")}</dt>
                  <dd>{selectedSource.canonicalUrl}</dd>
                </div>
              </dl>
              <a
                className={styles.sourceLink}
                href={selectedSource.canonicalUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink aria-hidden="true" size={16} />
                {t("openSource")}
              </a>
            </div>
          ) : (
            <p className={styles.emptySource}>{t("noSource")}</p>
          )}
        </aside>
      </div>
    </section>
  );
}
