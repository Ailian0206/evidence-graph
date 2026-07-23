import type {
  Claim,
  ClaimRelation,
  EvidenceLink,
  Source,
  SourceChunk,
} from "@/features/research/domain";
import {
  createWorkspaceReportFixture,
  publicReportSlugs,
} from "@/features/reports/report-fixture";
import type { EvidenceWorkspaceData } from "@/features/research/evidence-workspace";
import type { WorkflowStep } from "@/features/research/workflow-types";
import type { AppLocale } from "@/i18n/routing";

const FIXED_NOW = "2026-07-16T08:00:00.000Z";
const WORKFLOW_STEPS: WorkflowStep[] = [
  "planning",
  "searching",
  "collecting",
  "indexing",
  "extracting_claims",
  "linking_evidence",
  "detecting_conflicts",
  "drafting_report",
];

const workspaceCopy = {
  zh: {
    title: "可追溯引用是否让 AI 研究更容易审核？",
    question: "精确原文、反驳证据和人工审核如何提高 AI 研究结论的可信度？",
    sources: [
      {
        title: "产品研究访谈：从结论回到保存的原文片段",
        author: "研究参与者 07",
        body: "Evidence Graph 将每条主张连接到精确原文，让审核者能够从结论直接回到保存的上下文。",
        quote: "每条主张连接到精确原文",
      },
      {
        title: "可引用报告的产品约束与反例记录",
        author: "Evidence Graph 产品研究组",
        body: "只保留页面级链接不足以证明事实段落；报告必须保存证据关系和可核查的原文片段。",
        quote: "只保留页面级链接不足以证明事实段落",
      },
      {
        title: "限定条件如何避免把局部发现扩写成普遍结论",
        author: "方法研究笔记",
        body: "精确引用提升可审核性，但只有在来源正文完整保存并显示限定条件时才成立。",
        quote: "只有在来源正文完整保存并显示限定条件时才成立",
      },
      {
        title: "研究审计日志与模型输出保留策略",
        author: "工程验证记录",
        body: "人工接受或拒绝不会覆盖模型原始主张，运行步骤和失败原因会继续保留在审计记录中。",
        quote: "人工接受或拒绝不会覆盖模型原始主张",
      },
    ],
    claims: [
      "精确原文让审核者可以逐条核查 AI 研究主张。",
      "只有页面级链接也足以证明报告中的事实段落。",
      "引用可审核性的提升依赖于完整正文和限定条件。",
      "人工审核应保留模型原始输出和运行记录。",
    ],
    rationales: [
      "访谈直接描述了主张与精确原文之间的可追溯关系。",
      "产品约束明确反驳了页面级链接已经足够的说法。",
      "方法笔记限定了精确引用发挥作用的前提。",
      "工程记录提供了人工审核流程的上下文。",
    ],
  },
  en: {
    title: "Do traceable citations make AI research easier to review?",
    question: "How do exact excerpts, counterevidence, and human review improve AI research reliability?",
    sources: [
      {
        title: "Product interview: returning from a conclusion to its saved excerpt",
        author: "Research participant 07",
        body: "Evidence Graph connects every claim to an exact excerpt so reviewers can move from a conclusion back to its saved context.",
        quote: "connects every claim to an exact excerpt",
      },
      {
        title: "Product constraints and counterexamples for cited reports",
        author: "Evidence Graph research team",
        body: "Page-level links alone do not support factual paragraphs; reports must preserve evidence relations and inspectable excerpts.",
        quote: "Page-level links alone do not support factual paragraphs",
      },
      {
        title: "How qualifiers prevent local findings from becoming universal claims",
        author: "Research methods note",
        body: "Exact citations improve reviewability only when full source text and relevant qualifiers remain visible.",
        quote: "only when full source text and relevant qualifiers remain visible",
      },
      {
        title: "Research audit logs and model-output preservation",
        author: "Engineering validation record",
        body: "Human acceptance or rejection does not overwrite the original model claim, and run failures remain in the audit trail.",
        quote: "does not overwrite the original model claim",
      },
    ],
    claims: [
      "Exact excerpts let reviewers verify AI research claims one by one.",
      "Page-level links alone are sufficient support for factual report paragraphs.",
      "Citation reviewability depends on preserving full text and qualifiers.",
      "Human review should preserve the original model output and run record.",
    ],
    rationales: [
      "The interview directly describes traceability between claims and exact excerpts.",
      "The product constraint explicitly rebuts the idea that page-level links are sufficient.",
      "The methods note qualifies when exact citations improve reviewability.",
      "The engineering record provides context for the human-review workflow.",
    ],
  },
} as const;

export const createEvidenceWorkspaceFixture = (
  locale: AppLocale,
): EvidenceWorkspaceData => {
  const copy = workspaceCopy[locale];
  const projectId = "project_workspace_demo";
  const project = {
    id: projectId,
    ownerId: "user_ailian",
    title: copy.title,
    question: copy.question,
    language: locale,
    status: "active" as const,
    visibility: "public" as const,
    slug: publicReportSlugs[locale],
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  const sources: Source[] = copy.sources.map((source, index) => ({
    id: `workspace_source_${index + 1}`,
    projectId,
    canonicalUrl: `https://research.example.com/library/${index + 1}?project=evidence-graph&view=preserved-source-context`,
    title: source.title,
    author: source.author,
    publishedAt: `2026-07-${String(10 + index).padStart(2, "0")}T00:00:00.000Z`,
    domain: "research.example.com",
    sourceType: index === 0 ? "primary_interview" : "official_document",
    body: source.body,
    contentHash: `sha256_workspace_source_${index + 1}`,
    retrievedAt: FIXED_NOW,
  }));
  const chunks: SourceChunk[] = sources.map((source, index) => ({
    id: `workspace_chunk_${index + 1}`,
    sourceId: source.id,
    projectId,
    chunkIndex: 0,
    text: source.body,
    startChar: 0,
    endChar: source.body.length,
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
  }));
  const reviewStatuses: Claim["reviewStatus"][] = [
    "pending",
    "pending",
    "accepted",
    "rejected",
  ];
  const claims: Claim[] = copy.claims.map((statement, index) => ({
    id: `workspace_claim_${index + 1}`,
    projectId,
    statement,
    normalizedKey: `workspace claim ${index + 1}`,
    claimType: index === 2 ? "causal" : "factual",
    qualifiers: index === 2 ? [locale === "zh" ? "仅限保留完整正文" : "full text retained"] : [],
    confidence: [0.91, 0.38, 0.78, 0.84][index],
    reviewStatus: reviewStatuses[index],
    createdAt: FIXED_NOW,
  }));
  const relations: EvidenceLink["relation"][] = [
    "supports",
    "rebuts",
    "qualifies",
    "context",
  ];
  const evidenceLinks: EvidenceLink[] = claims.map((claim, index) => ({
    id: `workspace_link_${index + 1}`,
    claimId: claim.id,
    chunkId: chunks[index].id,
    projectId,
    relation: relations[index],
    strength: index === 2 ? "moderate" : "strong",
    quote: copy.sources[index].quote,
    rationale: copy.rationales[index],
  }));
  const claimRelations: ClaimRelation[] = [
    {
      id: "workspace_relation_1",
      projectId,
      fromClaimId: claims[0].id,
      toClaimId: claims[1].id,
      relation: "contradicts",
      rationale:
        locale === "zh"
          ? "精确原文要求与页面级链接已经足够的说法相互冲突。"
          : "Exact-excerpt requirements conflict with the claim that page-level links are sufficient.",
    },
  ];

  return {
    locale,
    project,
    run: {
      id: "workspace_run_demo",
      projectId,
      ownerId: project.ownerId,
      status: "ready",
      step: "ready",
      sourceLimit: 12,
      manualUrlLimit: 5,
      maxContentChars: 200000,
      estimatedCostUsd: 0.084,
      searchCount: 9,
      tokenCount: 18420,
      createdAt: FIXED_NOW,
      updatedAt: "2026-07-16T08:08:00.000Z",
    },
    sources,
    chunks,
    claims,
    evidenceLinks,
    claimRelations,
    runLogs: WORKFLOW_STEPS.map((step, index) => ({
      id: `workspace_log_${index + 1}`,
      runId: "workspace_run_demo",
      step,
      status: "completed",
      attempt: 1,
      timestamp: `2026-07-16T08:${String(index).padStart(2, "0")}:00.000Z`,
    })),
    reports: [createWorkspaceReportFixture(locale)],
  };
};
