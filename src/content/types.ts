export type LocalizedText = {
  zh: string;
  en: string;
};

export type ProjectStatus = "building" | "in-development";

export type PortfolioProject = {
  slug: string;
  name: LocalizedText;
  status: ProjectStatus;
  statusLabel: LocalizedText;
  summary: LocalizedText;
  problem: LocalizedText;
  approach: LocalizedText;
  proof: LocalizedText;
  tags: string[];
  repositoryUrl: string;
};

export type PracticeNote = {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  status: "research" | "draft";
  date: string;
};
