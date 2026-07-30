import type { EvidenceEvalInput } from "./evidence-eval";
import {
  EVIDENCE_EVAL_MANIFEST_VERSION,
  evidenceEvalManifest,
} from "./evidence-eval-manifest";

const relations = ["supports", "qualifies", "context", "rebuts"] as const;
const fixtureDomains = [
  "docs.example",
  "research.example",
  "standards.example",
  "data.example",
] as const;

export const createEvidenceEvalFixture = (): EvidenceEvalInput => ({
  manifestVersion: EVIDENCE_EVAL_MANIFEST_VERSION,
  cases: evidenceEvalManifest.map((manifestItem) => {
    const runId = `run_${manifestItem.id}`;
    const claimId = `claim_${manifestItem.id}`;
    const sources = fixtureDomains.map((domain, index) => ({
      id: `source_${manifestItem.id}_${index + 1}`,
      domain,
    }));
    const quotes = relations.map(
      (relation, index) =>
        `Fixture evidence ${index + 1} ${relation} the claim for ${manifestItem.id}.`,
    );
    const chunks = sources.map((source, index) => ({
      id: `chunk_${manifestItem.id}_${index + 1}`,
      sourceId: source.id,
      text: `Synthetic context. ${quotes[index]} Additional synthetic context.`,
    }));
    const evidenceLinks = relations.map((relation, index) => ({
      id: `link_${manifestItem.id}_${index + 1}`,
      claimId,
      chunkId: chunks[index].id,
      relation,
      quote: quotes[index],
    }));

    return {
      caseId: manifestItem.id,
      category: manifestItem.category,
      language: manifestItem.language,
      question: manifestItem.question,
      usableScenario: true,
      run: {
        id: runId,
        status: "ready" as const,
        estimatedCostUsd: 0,
      },
      sources,
      chunks,
      evidenceLinks,
      reports: [
        {
          id: `report_${manifestItem.id}`,
          paragraphs: [
            {
              id: `paragraph_${manifestItem.id}`,
              factual: true,
              citationIds: evidenceLinks.map((link) => link.id),
            },
          ],
        },
      ],
      relationSamples: evidenceLinks.map((link) => ({
        evidenceLinkId: link.id,
        expectedRelation: link.relation,
      })),
    };
  }),
});
