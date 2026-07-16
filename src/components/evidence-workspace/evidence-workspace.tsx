"use client";

import {
  Check,
  CircleDot,
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
  type EvidenceGraphElementData,
  type EvidenceWorkspaceData,
} from "@/features/research/evidence-workspace";

import styles from "./evidence-workspace.module.css";
import { WorkspaceClaimList } from "./workspace-claim-list";
import { WorkspaceGraph } from "./workspace-graph";
import { WorkspaceRunLog } from "./workspace-run-log";
import { WorkspaceSourceViewer } from "./workspace-source-viewer";

const reviewFilters: ClaimReviewFilter[] = [
  "all",
  "pending",
  "accepted",
  "rejected",
];
const mobileTabs = ["claims", "graph", "source", "log"] as const;
type MobileTab = (typeof mobileTabs)[number];

export function EvidenceWorkspace({ initialData }: { initialData: EvidenceWorkspaceData }) {
  const t = useTranslations("Workspace");
  const [claims, setClaims] = useState(initialData.claims);
  const [reviewFilter, setReviewFilter] = useState<ClaimReviewFilter>("all");
  const [activeRelations, setActiveRelations] = useState(
    new Set(initialData.evidenceLinks.map((link) => link.relation)),
  );
  const [selectedClaimId, setSelectedClaimId] = useState(initialData.claims[0]?.id ?? "");
  const [selectedEvidenceLinkId, setSelectedEvidenceLinkId] = useState(
    initialData.evidenceLinks[0]?.id ?? "",
  );
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("claims");
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
  const selectedEvidence =
    selectedSummary?.evidenceLinks.find(
      (link) => link.id === selectedEvidenceLinkId && activeRelations.has(link.relation),
    ) ?? selectedSummary?.evidenceLinks.find((link) => activeRelations.has(link.relation));
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
  const handleSelectClaim = (claimId: string) => {
    setSelectedClaimId(claimId);
    const firstEvidence = workspace.evidenceLinks.find(
      (link) => link.claimId === claimId && activeRelations.has(link.relation),
    );

    if (firstEvidence) {
      setSelectedEvidenceLinkId(firstEvidence.id);
    }
  };
  const handleSelectGraphNode = (data: EvidenceGraphElementData) => {
    if (data.claimId) {
      setSelectedClaimId(data.claimId);
    }

    if (data.evidenceLinkId) {
      setSelectedEvidenceLinkId(data.evidenceLinkId);
      return;
    }

    if (data.sourceId) {
      const sourceChunkIds = new Set(
        workspace.chunks
          .filter((chunk) => chunk.sourceId === data.sourceId)
          .map((chunk) => chunk.id),
      );
      const sourceEvidence = workspace.evidenceLinks.find(
        (link) => sourceChunkIds.has(link.chunkId) && activeRelations.has(link.relation),
      );

      if (sourceEvidence) {
        setSelectedClaimId(sourceEvidence.claimId);
        setSelectedEvidenceLinkId(sourceEvidence.id);
      }
    }
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
  const handleMobileTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? mobileTabs.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + mobileTabs.length) %
            mobileTabs.length;
    const nextTab = mobileTabs[nextIndex];
    setActiveMobileTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`workspace-tab-${nextTab}`)?.focus());
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

      <div className={styles.mobileTabs} role="tablist" aria-label={t("mobileTabsLabel")}>
        {mobileTabs.map((tab, index) => (
          <button
            key={tab}
            id={`workspace-tab-${tab}`}
            type="button"
            role="tab"
            aria-controls={`workspace-panel-${tab}`}
            aria-selected={activeMobileTab === tab}
            tabIndex={activeMobileTab === tab ? 0 : -1}
            onClick={() => setActiveMobileTab(tab)}
            onKeyDown={(event) => handleMobileTabKeyDown(event, index)}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div className={styles.workspaceGrid}>
        <section
          id="workspace-panel-claims"
          className={`${styles.panel} ${styles.claimPanel}`}
          aria-labelledby="workspace-tab-claims"
          data-mobile-active={activeMobileTab === "claims"}
          role="tabpanel"
        >
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
            onSelect={handleSelectClaim}
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

        <section
          id="workspace-panel-graph"
          className={`${styles.panel} ${styles.graphPanel}`}
          aria-labelledby="workspace-tab-graph"
          data-mobile-active={activeMobileTab === "graph"}
          role="tabpanel"
        >
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
          <div className={styles.graphCanvas}>
            <WorkspaceGraph
              elements={graphElements}
              selectedNodeId={
                selectedEvidence
                  ? `evidence:${selectedEvidence.id}`
                  : `claim:${selectedClaim?.id ?? ""}`
              }
              labels={{
                ariaLabel: t("graph.ariaLabel"),
                navigatorLabel: t("graph.navigatorLabel"),
                keyboardHint: t("graph.keyboardHint"),
                claim: t("graph.claimNode"),
                evidence: t("graph.evidenceNode"),
                source: t("graph.sourceNode"),
                separator: t("graph.labelSeparator"),
              }}
              onSelect={handleSelectGraphNode}
            />
          </div>
        </section>

        <WorkspaceSourceViewer
          locale={workspace.locale}
          evidence={selectedEvidence}
          source={selectedSource}
          mobileActive={activeMobileTab === "source"}
        />
      </div>
      <WorkspaceRunLog
        locale={workspace.locale}
        run={workspace.run}
        entries={workspace.runLogs}
        mobileActive={activeMobileTab === "log"}
      />
    </section>
  );
}
