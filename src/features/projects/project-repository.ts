import type {
  Claim,
  ClaimRelation,
  EvidenceLink,
  Project,
  ResearchRun,
  Source,
  SourceChunk,
} from "@/features/research/domain";
import type { DemoResearchFixture } from "@/features/research/fixtures";
import { validateExactQuote } from "@/features/claims/claim-utils";

export type InMemoryProjectRepository = {
  listProjects: (ownerId: string) => Project[];
  listSources: (input: { ownerId: string; projectId: string }) => Source[];
  listChunks: (input: {
    ownerId: string;
    projectId: string;
    sourceId: string;
  }) => SourceChunk[];
  listClaims: (input: { ownerId: string; projectId: string }) => Claim[];
  listResearchRuns: (input: { ownerId: string; projectId: string }) => ResearchRun[];
  listClaimRelations: (input: {
    ownerId: string;
    projectId: string;
  }) => ClaimRelation[];
  addSource: (input: { ownerId: string; source: Source }) => void;
  addClaim: (input: { ownerId: string; claim: Claim }) => void;
  addEvidenceLink: (input: { ownerId: string; link: EvidenceLink }) => void;
  deleteProject: (input: { ownerId: string; projectId: string }) => void;
};

export const createInMemoryProjectRepository = (
  fixture: DemoResearchFixture,
): InMemoryProjectRepository => {
  const projects = new Map(fixture.projects.map((project) => [project.id, project]));
  const researchRuns = new Map(fixture.researchRuns.map((run) => [run.id, run]));
  const sources = new Map<string, Source>();
  const chunks = new Map(fixture.chunks.map((chunk) => [chunk.id, chunk]));
  const claims = new Map<string, Claim>();
  const evidenceLinks = new Map<string, EvidenceLink>();
  const claimRelations = new Map(
    fixture.claimRelations.map((relation) => [relation.id, relation]),
  );

  const canAccessProject = (ownerId: string, projectId: string) => {
    const project = projects.get(projectId);
    return project?.ownerId === ownerId && project.status !== "deleted";
  };

  const requireOwnedProject = (ownerId: string, projectId: string) => {
    if (!canAccessProject(ownerId, projectId)) {
      throw new Error("PROJECT_NOT_FOUND");
    }
  };

  const assertUniqueSource = (source: Source) => {
    for (const current of sources.values()) {
      if (current.id === source.id) {
        throw new Error("SOURCE_ALREADY_EXISTS");
      }

      if (
        current.projectId === source.projectId &&
        current.canonicalUrl === source.canonicalUrl
      ) {
        throw new Error("SOURCE_ALREADY_EXISTS");
      }

      if (current.contentHash === source.contentHash) {
        throw new Error("SOURCE_ALREADY_EXISTS");
      }
    }
  };

  const assertUniqueClaim = (claim: Claim) => {
    for (const current of claims.values()) {
      if (
        current.id === claim.id ||
        (current.projectId === claim.projectId && current.normalizedKey === claim.normalizedKey)
      ) {
        throw new Error("CLAIM_ALREADY_EXISTS");
      }
    }
  };

  const assertUniqueEvidenceLink = (link: EvidenceLink) => {
    for (const current of evidenceLinks.values()) {
      if (
        current.id === link.id ||
        current.claimId === link.claimId &&
        current.chunkId === link.chunkId &&
        current.relation === link.relation
      ) {
        throw new Error("EVIDENCE_LINK_ALREADY_EXISTS");
      }
    }
  };

  const assertValidEvidenceLink = (link: EvidenceLink) => {
    const claim = claims.get(link.claimId);
    const chunk = chunks.get(link.chunkId);

    if (
      !claim ||
      !chunk ||
      claim.projectId !== link.projectId ||
      chunk.projectId !== link.projectId
    ) {
      throw new Error("EVIDENCE_TARGET_NOT_FOUND");
    }

    const quoteValidation = validateExactQuote({ chunkText: chunk.text, quote: link.quote });

    if (!quoteValidation.ok) {
      throw new Error(quoteValidation.reason);
    }
  };

  for (const source of fixture.sources) {
    assertUniqueSource(source);
    sources.set(source.id, source);
  }

  for (const claim of fixture.claims) {
    assertUniqueClaim(claim);
    claims.set(claim.id, claim);
  }

  for (const link of fixture.evidenceLinks) {
    assertValidEvidenceLink(link);
    assertUniqueEvidenceLink(link);
    evidenceLinks.set(link.id, link);
  }

  return {
    listProjects: (ownerId) =>
      Array.from(projects.values()).filter(
        (project) => project.ownerId === ownerId && project.status !== "deleted",
      ),
    listSources: ({ ownerId, projectId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(sources.values()).filter((source) => source.projectId === projectId)
        : [],
    listChunks: ({ ownerId, projectId, sourceId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(chunks.values()).filter(
            (chunk) => chunk.projectId === projectId && chunk.sourceId === sourceId,
          )
        : [],
    listClaims: ({ ownerId, projectId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(claims.values()).filter((claim) => claim.projectId === projectId)
        : [],
    listResearchRuns: ({ ownerId, projectId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(researchRuns.values()).filter((run) => run.projectId === projectId)
        : [],
    listClaimRelations: ({ ownerId, projectId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(claimRelations.values()).filter(
            (relation) => relation.projectId === projectId,
          )
        : [],
    addSource: ({ ownerId, source }) => {
      requireOwnedProject(ownerId, source.projectId);
      assertUniqueSource(source);
      sources.set(source.id, source);
    },
    addClaim: ({ ownerId, claim }) => {
      requireOwnedProject(ownerId, claim.projectId);
      assertUniqueClaim(claim);
      claims.set(claim.id, claim);
    },
    addEvidenceLink: ({ ownerId, link }) => {
      requireOwnedProject(ownerId, link.projectId);
      assertValidEvidenceLink(link);
      assertUniqueEvidenceLink(link);
      evidenceLinks.set(link.id, link);
    },
    deleteProject: ({ ownerId, projectId }) => {
      const project = projects.get(projectId);

      if (!project || project.ownerId !== ownerId) {
        throw new Error("PROJECT_NOT_FOUND");
      }

      projects.delete(projectId);

      for (const [sourceId, source] of sources.entries()) {
        if (source.projectId === projectId) {
          sources.delete(sourceId);
        }
      }

      for (const [chunkId, chunk] of chunks.entries()) {
        if (chunk.projectId === projectId) {
          chunks.delete(chunkId);
        }
      }

      for (const [claimId, claim] of claims.entries()) {
        if (claim.projectId === projectId) {
          claims.delete(claimId);
        }
      }

      for (const [linkId, link] of evidenceLinks.entries()) {
        if (link.projectId === projectId) {
          evidenceLinks.delete(linkId);
        }
      }

      for (const [runId, run] of researchRuns.entries()) {
        if (run.projectId === projectId) {
          researchRuns.delete(runId);
        }
      }

      for (const [relationId, relation] of claimRelations.entries()) {
        if (relation.projectId === projectId) {
          claimRelations.delete(relationId);
        }
      }
    },
  };
};
