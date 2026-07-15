import type {
  Claim,
  EvidenceLink,
  Project,
  Source,
  SourceChunk,
} from "@/features/research/domain";
import type { DemoResearchFixture } from "@/features/research/fixtures";
import { validateExactQuote } from "@/features/claims/claim-utils";

export type InMemoryProjectRepository = {
  listProjects: (ownerId: string) => Project[];
  listSources: (projectId: string) => Source[];
  listChunks: (sourceId: string) => SourceChunk[];
  listClaims: (projectId: string) => Claim[];
  addSource: (source: Source) => void;
  addEvidenceLink: (link: EvidenceLink) => void;
  deleteProject: (input: { ownerId: string; projectId: string }) => void;
};

export const createInMemoryProjectRepository = (
  fixture: DemoResearchFixture,
): InMemoryProjectRepository => {
  const projects = new Map(fixture.projects.map((project) => [project.id, project]));
  const sources = new Map(fixture.sources.map((source) => [source.id, source]));
  const chunks = new Map(fixture.chunks.map((chunk) => [chunk.id, chunk]));
  const claims = new Map(fixture.claims.map((claim) => [claim.id, claim]));
  const evidenceLinks = new Map(fixture.evidenceLinks.map((link) => [link.id, link]));

  const assertUniqueSource = (source: Source) => {
    for (const current of sources.values()) {
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

  const assertUniqueEvidenceLink = (link: EvidenceLink) => {
    for (const current of evidenceLinks.values()) {
      if (
        current.claimId === link.claimId &&
        current.chunkId === link.chunkId &&
        current.relation === link.relation
      ) {
        throw new Error("EVIDENCE_LINK_ALREADY_EXISTS");
      }
    }
  };

  return {
    listProjects: (ownerId) =>
      Array.from(projects.values()).filter(
        (project) => project.ownerId === ownerId && project.status !== "deleted",
      ),
    listSources: (projectId) =>
      Array.from(sources.values()).filter((source) => source.projectId === projectId),
    listChunks: (sourceId) =>
      Array.from(chunks.values()).filter((chunk) => chunk.sourceId === sourceId),
    listClaims: (projectId) =>
      Array.from(claims.values()).filter((claim) => claim.projectId === projectId),
    addSource: (source) => {
      assertUniqueSource(source);
      sources.set(source.id, source);
    },
    addEvidenceLink: (link) => {
      const chunk = chunks.get(link.chunkId);

      if (!chunk) {
        throw new Error("CHUNK_NOT_FOUND");
      }

      const quoteValidation = validateExactQuote({ chunkText: chunk.text, quote: link.quote });

      if (!quoteValidation.ok) {
        throw new Error(quoteValidation.reason);
      }

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
    },
  };
};
