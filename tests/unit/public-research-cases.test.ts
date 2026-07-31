import { describe, expect, it } from "vitest";

import {
  getPublicResearchCase,
  publicResearchCases,
} from "@/content/public-research-cases";
import { publicCaseReports } from "@/features/reports/public-case-reports";

const expectedSlugs = [
  "cyberverse-commercial-foundation",
  "evidence-graph-vs-ai-search",
  "long-running-ai-infrastructure",
];

const countChineseCharacters = (value: string) =>
  Array.from(value).filter((character) => /[\u3400-\u9fff]/u.test(character)).length;

describe("public research cases", () => {
  it("publishes exactly the three fixed C5 questions", () => {
    expect(publicResearchCases.map((researchCase) => researchCase.slug)).toEqual(
      expectedSlugs,
    );
    expect(new Set(publicResearchCases.map((researchCase) => researchCase.reportSlug)).size).toBe(
      3,
    );
  });

  it("keeps every public field meaningfully localized", () => {
    for (const researchCase of publicResearchCases) {
      const localizedValues = [
        researchCase.title,
        researchCase.summary,
        researchCase.question,
        researchCase.scope,
        researchCase.decision,
        ...researchCase.limitations,
        researchCase.failure.what,
        researchCase.failure.correction,
        ...researchCase.article.flatMap((section) => [
          section.heading,
          ...section.paragraphs,
        ]),
        ...researchCase.graph.nodes.flatMap((node) => [node.label, node.detail]),
      ];

      for (const value of localizedValues) {
        expect(value.zh.trim()).not.toBe("");
        expect(value.en.trim().length).toBeGreaterThan(3);
      }

      for (const section of researchCase.article) {
        for (const paragraph of section.paragraphs) {
          expect(paragraph.en.trim().length).toBeGreaterThan(80);
        }
      }
    }
  });

  it("keeps each Chinese article between 800 and 1,500 Chinese characters", () => {
    for (const researchCase of publicResearchCases) {
      const article = researchCase.article
        .flatMap((section) => [section.heading.zh, ...section.paragraphs.map((item) => item.zh)])
        .join("");

      expect(countChineseCharacters(article)).toBeGreaterThanOrEqual(800);
      expect(countChineseCharacters(article)).toBeLessThanOrEqual(1_500);
    }
  });

  it("keeps source to evidence to claim to decision graph references resolvable", () => {
    for (const researchCase of publicResearchCases) {
      const nodeIds = new Set(researchCase.graph.nodes.map((node) => node.id));
      expect(researchCase.graph.nodes.map((node) => node.type)).toEqual(
        expect.arrayContaining(["source", "evidence", "claim", "decision"]),
      );

      for (const edge of researchCase.graph.edges) {
        expect(nodeIds.has(edge.from)).toBe(true);
        expect(nodeIds.has(edge.to)).toBe(true);
      }
    }
  });

  it("reports the number of unique source documents in each public snapshot", () => {
    for (const researchCase of publicResearchCases) {
      const report = publicCaseReports.find(
        (candidate) => candidate.report.slug === researchCase.reportSlug,
      );
      const sourceIds = new Set(
        report?.report.citations.map((citation) => citation.sourceId),
      );

      expect(report).toBeDefined();
      expect(researchCase.sourceCount).toBe(sourceIds.size);
    }
  });

  it("finds known slugs without exposing private run material", () => {
    expect(getPublicResearchCase(expectedSlugs[0])?.slug).toBe(expectedSlugs[0]);
    expect(getPublicResearchCase("missing-case")).toBeUndefined();

    const serialized = JSON.stringify(publicResearchCases);
    for (const privateField of [
      "providerResponse",
      "sourceBody",
      "userId",
      "runLog",
      "estimatedCostUsd",
    ]) {
      expect(serialized).not.toContain(privateField);
    }
  });
});
