import {
  claimRelationSchema,
  claimSchema,
  evidenceLinkSchema,
  projectSchema,
  researchRunSchema,
  sourceChunkSchema,
  sourceSchema,
  type Claim,
  type ClaimRelation,
  type EvidenceLink,
  type Project,
  type ResearchRun,
  type Source,
  type SourceChunk,
} from "@/features/research/domain";
import type { DemoResearchFixture } from "@/features/research/fixtures";
import { validateExactQuote } from "@/features/claims/claim-utils";

const cloneValue = <T>(value: T): T => structuredClone(value);

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
  const projects = new Map<string, Project>();
  const researchRuns = new Map<string, ResearchRun>();
  const sources = new Map<string, Source>();
  const chunks = new Map<string, SourceChunk>();
  const claims = new Map<string, Claim>();
  const evidenceLinks = new Map<string, EvidenceLink>();
  const claimRelations = new Map<string, ClaimRelation>();

  for (const input of fixture.projects) {
    const project = projectSchema.parse(input);

    if (projects.has(project.id)) {
      throw new Error("PROJECT_ALREADY_EXISTS");
    }

    projects.set(project.id, cloneValue(project));
  }

  for (const input of fixture.researchRuns) {
    const run = researchRunSchema.parse(input);
    const project = projects.get(run.projectId);

    if (researchRuns.has(run.id)) {
      throw new Error("RUN_ALREADY_EXISTS");
    }

    if (!project || project.ownerId !== run.ownerId) {
      throw new Error("RUN_PROJECT_MISMATCH");
    }

    researchRuns.set(run.id, cloneValue(run));
  }

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

      if (
        current.projectId === source.projectId &&
        current.contentHash === source.contentHash
      ) {
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

  for (const input of fixture.sources) {
    const source = sourceSchema.parse(input);

    if (!projects.has(source.projectId)) {
      throw new Error("SOURCE_PROJECT_NOT_FOUND");
    }

    assertUniqueSource(source);
    sources.set(source.id, cloneValue(source));
  }

  for (const input of fixture.chunks) {
    const chunk = sourceChunkSchema.parse(input);
    const source = sources.get(chunk.sourceId);
    const sourceCharacters = source ? Array.from(source.body) : [];
    const duplicate =
      chunks.has(chunk.id) ||
      Array.from(chunks.values()).some(
        (current) =>
          current.sourceId === chunk.sourceId && current.chunkIndex === chunk.chunkIndex,
      );

    if (duplicate) {
      throw new Error("CHUNK_ALREADY_EXISTS");
    }

    const offsetsMatchSource =
      source &&
      chunk.startChar < chunk.endChar &&
      chunk.endChar <= sourceCharacters.length &&
      Array.from(chunk.text).length === chunk.endChar - chunk.startChar &&
      sourceCharacters.slice(chunk.startChar, chunk.endChar).join("") === chunk.text;

    if (!source || source.projectId !== chunk.projectId || !offsetsMatchSource) {
      throw new Error("CHUNK_SOURCE_MISMATCH");
    }

    chunks.set(chunk.id, cloneValue(chunk));
  }

  for (const input of fixture.claims) {
    const claim = claimSchema.parse(input);

    if (!projects.has(claim.projectId)) {
      throw new Error("CLAIM_PROJECT_NOT_FOUND");
    }

    assertUniqueClaim(claim);
    claims.set(claim.id, cloneValue(claim));
  }

  for (const input of fixture.evidenceLinks) {
    const link = evidenceLinkSchema.parse(input);
    assertValidEvidenceLink(link);
    assertUniqueEvidenceLink(link);
    evidenceLinks.set(link.id, cloneValue(link));
  }

  for (const input of fixture.claimRelations) {
    const relation = claimRelationSchema.parse(input);
    const fromClaim = claims.get(relation.fromClaimId);
    const toClaim = claims.get(relation.toClaimId);
    const duplicate =
      claimRelations.has(relation.id) ||
      Array.from(claimRelations.values()).some(
        (current) =>
          current.fromClaimId === relation.fromClaimId &&
          current.toClaimId === relation.toClaimId &&
          current.relation === relation.relation,
      );

    if (duplicate) {
      throw new Error("CLAIM_RELATION_ALREADY_EXISTS");
    }

    if (relation.fromClaimId === relation.toClaimId) {
      throw new Error("CLAIM_RELATION_SELF_REFERENCE");
    }

    if (
      !fromClaim ||
      !toClaim ||
      fromClaim.projectId !== relation.projectId ||
      toClaim.projectId !== relation.projectId
    ) {
      throw new Error("CLAIM_RELATION_TARGET_NOT_FOUND");
    }

    claimRelations.set(relation.id, cloneValue(relation));
  }

  return {
    listProjects: (ownerId) =>
      Array.from(projects.values()).filter(
        (project) => project.ownerId === ownerId && project.status !== "deleted",
      ).map(cloneValue),
    listSources: ({ ownerId, projectId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(sources.values())
            .filter((source) => source.projectId === projectId)
            .map(cloneValue)
        : [],
    listChunks: ({ ownerId, projectId, sourceId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(chunks.values()).filter(
            (chunk) => chunk.projectId === projectId && chunk.sourceId === sourceId,
          ).map(cloneValue)
        : [],
    listClaims: ({ ownerId, projectId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(claims.values())
            .filter((claim) => claim.projectId === projectId)
            .map(cloneValue)
        : [],
    listResearchRuns: ({ ownerId, projectId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(researchRuns.values())
            .filter((run) => run.projectId === projectId)
            .map(cloneValue)
        : [],
    listClaimRelations: ({ ownerId, projectId }) =>
      canAccessProject(ownerId, projectId)
        ? Array.from(claimRelations.values()).filter(
            (relation) => relation.projectId === projectId,
          ).map(cloneValue)
        : [],
    addSource: ({ ownerId, source: input }) => {
      const source = sourceSchema.parse(input);
      requireOwnedProject(ownerId, source.projectId);
      assertUniqueSource(source);
      sources.set(source.id, cloneValue(source));
    },
    addClaim: ({ ownerId, claim: input }) => {
      const claim = claimSchema.parse(input);
      requireOwnedProject(ownerId, claim.projectId);
      assertUniqueClaim(claim);
      claims.set(claim.id, cloneValue(claim));
    },
    addEvidenceLink: ({ ownerId, link: input }) => {
      const link = evidenceLinkSchema.parse(input);
      requireOwnedProject(ownerId, link.projectId);
      assertValidEvidenceLink(link);
      assertUniqueEvidenceLink(link);
      evidenceLinks.set(link.id, cloneValue(link));
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
