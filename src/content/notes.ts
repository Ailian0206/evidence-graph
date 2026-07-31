import type { PracticeNote } from "./types";
import { publicResearchCases } from "./public-research-cases";

export const notes: PracticeNote[] = publicResearchCases.map((researchCase) => ({
  slug: researchCase.slug,
  title: researchCase.title,
  summary: researchCase.summary,
  status: "published",
  date: researchCase.researchedAt,
}));
