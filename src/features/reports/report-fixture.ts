import type {
  PublicReport,
  PublishableReport,
} from "@/features/reports/report-store";
import type { AppLocale } from "@/i18n/routing";

const FIXED_CREATED_AT = "2026-07-16T08:07:00.000Z";
const FIXED_PUBLISHED_AT = "2026-07-17T10:00:00.000Z";

export const publicReportSlugs = {
  zh: "traceable-citations-review-zh",
  en: "traceable-citations-review-en",
} as const;

const reportCopy = {
  zh: {
    title: "可追溯引用是否让 AI 研究更容易审核？",
    question: "精确原文、反驳证据和人工审核如何提高 AI 研究结论的可信度？",
    headings: ["精确引用降低核查成本", "反驳证据必须保持可见", "人工审核不能覆盖原始记录"],
    findings: [
      "精确原文让审核者可以逐条核查 AI 研究主张。[workspace_link_1]",
      "只有页面级链接不足以支持事实段落，反驳证据必须和结论一起保留。[workspace_link_2]",
      "人工接受或拒绝主张时，模型原始输出和运行记录仍需保留。[workspace_link_4]",
    ],
    sourceTitles: [
      "产品研究访谈：从结论回到保存的原文片段",
      "可引用报告的产品约束与反例记录",
      "研究审计日志与模型输出保留策略",
    ],
    quotes: [
      "每条主张连接到精确原文",
      "只保留页面级链接不足以证明事实段落",
      "人工接受或拒绝不会覆盖模型原始主张",
    ],
  },
  en: {
    title: "Do traceable citations make AI research easier to review?",
    question: "How do exact excerpts, counterevidence, and human review improve AI research reliability?",
    headings: [
      "Exact citations reduce verification cost",
      "Counterevidence must remain visible",
      "Human review must preserve the original record",
    ],
    findings: [
      "Exact excerpts let reviewers verify AI research claims one by one. [workspace_link_1]",
      "Page-level links alone do not support factual paragraphs, so counterevidence must remain attached to the conclusion. [workspace_link_2]",
      "Accepting or rejecting a claim must preserve the original model output and run record. [workspace_link_4]",
    ],
    sourceTitles: [
      "Product interview: returning from a conclusion to its saved excerpt",
      "Product constraints and counterexamples for cited reports",
      "Research audit logs and model-output preservation",
    ],
    quotes: [
      "connects every claim to an exact excerpt",
      "Page-level links alone do not support factual paragraphs",
      "does not overwrite the original model claim",
    ],
  },
} as const;

export const createWorkspaceReportFixture = (
  locale: AppLocale,
): PublishableReport => {
  const copy = reportCopy[locale];
  const citationIndexes = [1, 2, 4];
  const citations = citationIndexes.map((sourceIndex, index) => ({
    evidenceLinkId: `workspace_link_${sourceIndex}`,
    claimId: `workspace_claim_${sourceIndex}`,
    chunkId: `workspace_chunk_${sourceIndex}`,
    sourceId: `workspace_source_${sourceIndex}`,
    quote: copy.quotes[index],
    sourceUrl: `https://research.example.com/library/${sourceIndex}?project=evidence-graph&view=preserved-source-context`,
    sourceTitle: copy.sourceTitles[index],
  }));
  const sections = copy.findings.map((markdown, index) => ({
    id: `workspace_report_section_${index + 1}`,
    heading: copy.headings[index],
    factual: true,
    markdown,
    citationIds: [citations[index].evidenceLinkId],
  }));

  return {
    id: `workspace_report_${locale}`,
    runId: "workspace_run_demo",
    projectId: "project_workspace_demo",
    slug: publicReportSlugs[locale],
    markdown: sections.map((section) => `## ${section.heading}\n\n${section.markdown}`).join("\n\n"),
    sections,
    citations,
    version: 1,
    status: "published",
    publishedAt: FIXED_PUBLISHED_AT,
    createdAt: FIXED_CREATED_AT,
  };
};

const createPublicReportFixture = (locale: AppLocale): PublicReport => {
  const copy = reportCopy[locale];
  const report = createWorkspaceReportFixture(locale);

  return {
    language: locale,
    title: copy.title,
    question: copy.question,
    report: {
      id: report.id,
      slug: report.slug as string,
      markdown: report.markdown,
      sections: report.sections,
      citations: report.citations,
      version: report.version,
      status: "published",
      publishedAt: report.publishedAt as string,
    },
  };
};

export const findPublicReportFixture = (slug: string) => {
  const locale = (Object.keys(publicReportSlugs) as AppLocale[]).find(
    (candidate) => publicReportSlugs[candidate] === slug,
  );
  return locale ? createPublicReportFixture(locale) : undefined;
};
