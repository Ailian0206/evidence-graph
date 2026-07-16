import type {
  Claim,
  ClaimRelation,
  EvidenceLink,
  Project,
  ResearchRun,
  Source,
  SourceChunk,
} from "@/features/research/domain";
import type { RunLogEntry } from "@/features/research/workflow-types";
import type { AppLocale } from "@/i18n/routing";

export const workspaceEvidenceRelations = [
  "supports",
  "rebuts",
  "qualifies",
  "context",
] as const satisfies readonly EvidenceLink["relation"][];

export type ClaimReviewFilter = "all" | Claim["reviewStatus"];

export type EvidenceWorkspaceData = {
  locale: AppLocale;
  project: Project;
  run: ResearchRun;
  sources: Source[];
  chunks: SourceChunk[];
  claims: Claim[];
  evidenceLinks: EvidenceLink[];
  claimRelations: ClaimRelation[];
  runLogs: RunLogEntry[];
};

export type WorkspaceClaimSummary = {
  claim: Claim;
  evidenceLinks: EvidenceLink[];
  relationCounts: Record<EvidenceLink["relation"], number>;
};

type EvidenceGraphElementData = {
  id: string;
  label: string;
  kind:
    | "claim"
    | "evidence"
    | "source"
    | "claim-evidence"
    | "evidence-source"
    | "claim-relation";
  claimId?: string;
  evidenceLinkId?: string;
  sourceId?: string;
  relation?: EvidenceLink["relation"] | ClaimRelation["relation"];
  source?: string;
  target?: string;
};

export type EvidenceGraphElement = {
  group: "nodes" | "edges";
  data: EvidenceGraphElementData;
};

const createEmptyRelationCounts = (): WorkspaceClaimSummary["relationCounts"] => ({
  supports: 0,
  rebuts: 0,
  qualifies: 0,
  context: 0,
});

export const createWorkspaceClaimSummaries = ({
  claims,
  evidenceLinks,
}: Pick<EvidenceWorkspaceData, "claims" | "evidenceLinks">): WorkspaceClaimSummary[] =>
  claims.map((claim) => {
    const claimEvidenceLinks = evidenceLinks.filter((link) => link.claimId === claim.id);
    const relationCounts = claimEvidenceLinks.reduce(
      (counts, link) => ({ ...counts, [link.relation]: counts[link.relation] + 1 }),
      createEmptyRelationCounts(),
    );

    return {
      claim,
      evidenceLinks: claimEvidenceLinks,
      relationCounts,
    };
  });

export const filterWorkspaceClaims = ({
  claims,
  reviewStatus,
  relations,
}: {
  claims: WorkspaceClaimSummary[];
  reviewStatus: ClaimReviewFilter;
  relations: readonly EvidenceLink["relation"][];
}) => {
  const activeRelations = new Set(relations);

  if (activeRelations.size === 0) {
    return [];
  }

  return claims.filter(
    ({ claim, evidenceLinks }) =>
      (reviewStatus === "all" || claim.reviewStatus === reviewStatus) &&
      evidenceLinks.some((link) => activeRelations.has(link.relation)),
  );
};

export const reviewWorkspaceClaim = ({
  claims,
  claimId,
  reviewStatus,
}: {
  claims: Claim[];
  claimId: string;
  reviewStatus: Claim["reviewStatus"];
}) => {
  if (!claims.some((claim) => claim.id === claimId)) {
    throw new Error("CLAIM_NOT_FOUND");
  }

  return claims.map((claim) => ({
    ...claim,
    qualifiers: [...claim.qualifiers],
    reviewStatus: claim.id === claimId ? reviewStatus : claim.reviewStatus,
  }));
};

export const createEvidenceGraphElements = ({
  claims,
  evidenceLinks,
  claimRelations,
  chunks,
  sources,
  relations,
}: EvidenceWorkspaceData & {
  relations: readonly EvidenceLink["relation"][];
}): EvidenceGraphElement[] => {
  const elements: EvidenceGraphElement[] = claims.map((claim) => ({
    group: "nodes",
    data: {
      id: `claim:${claim.id}`,
      label: claim.statement,
      kind: "claim",
      claimId: claim.id,
    },
  }));
  const activeRelations = new Set(relations);
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const addedSourceIds = new Set<string>();

  for (const link of evidenceLinks) {
    if (!activeRelations.has(link.relation)) {
      continue;
    }

    const chunk = chunkById.get(link.chunkId);
    const source = chunk ? sourceById.get(chunk.sourceId) : undefined;

    if (!chunk || !source) {
      continue;
    }

    const claimNodeId = `claim:${link.claimId}`;
    const evidenceNodeId = `evidence:${link.id}`;
    const sourceNodeId = `source:${source.id}`;

    elements.push(
      {
        group: "nodes",
        data: {
          id: evidenceNodeId,
          label: link.quote,
          kind: "evidence",
          claimId: link.claimId,
          evidenceLinkId: link.id,
          sourceId: source.id,
          relation: link.relation,
        },
      },
      {
        group: "edges",
        data: {
          id: `edge:claim-evidence:${link.id}`,
          label: link.relation,
          kind: "claim-evidence",
          claimId: link.claimId,
          evidenceLinkId: link.id,
          sourceId: source.id,
          relation: link.relation,
          source: claimNodeId,
          target: evidenceNodeId,
        },
      },
      {
        group: "edges",
        data: {
          id: `edge:evidence-source:${link.id}`,
          label: "source",
          kind: "evidence-source",
          claimId: link.claimId,
          evidenceLinkId: link.id,
          sourceId: source.id,
          relation: link.relation,
          source: evidenceNodeId,
          target: sourceNodeId,
        },
      },
    );

    if (!addedSourceIds.has(source.id)) {
      elements.push({
        group: "nodes",
        data: {
          id: sourceNodeId,
          label: source.title,
          kind: "source",
          sourceId: source.id,
        },
      });
      addedSourceIds.add(source.id);
    }
  }

  const claimIds = new Set(claims.map((claim) => claim.id));

  for (const relation of claimRelations) {
    if (!claimIds.has(relation.fromClaimId) || !claimIds.has(relation.toClaimId)) {
      continue;
    }

    elements.push({
      group: "edges",
      data: {
        id: `edge:claim-relation:${relation.id}`,
        label: relation.relation,
        kind: "claim-relation",
        relation: relation.relation,
        source: `claim:${relation.fromClaimId}`,
        target: `claim:${relation.toClaimId}`,
      },
    });
  }

  return elements;
};
