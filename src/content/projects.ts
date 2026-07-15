import type { PortfolioProject } from "./types";

export const publicProjects: PortfolioProject[] = [
  {
    slug: "evidence-graph",
    name: { zh: "Evidence Graph", en: "Evidence Graph" },
    status: "building",
    statusLabel: { zh: "开发中", en: "Building" },
    summary: {
      zh: "把搜索结果拆成可审核的主张、证据和来源关系，而不是再生成一段无法追溯的总结。",
      en: "Turns search results into reviewable claims, evidence, and source relationships instead of another untraceable summary.",
    },
    problem: {
      zh: "AI 研究回答很快，但页面级引用不足以说明每个事实来自哪里，也容易把支持与反驳混在一起。",
      en: "AI research answers are fast, but page-level citations rarely prove where each fact came from and often blur support with contradiction.",
    },
    approach: {
      zh: "持久化 Source、Claim、Evidence Link 和冲突关系，并要求报告中的事实段落都能定位到原文片段。",
      en: "Persist Sources, Claims, Evidence Links, and conflicts, then require every factual report paragraph to resolve to exact source excerpts.",
    },
    proof: {
      zh: "当前正在建立双语作品集、证据领域模型、可重复研究工作流与公开报告。",
      en: "Currently building the bilingual portfolio, evidence domain model, repeatable research workflow, and public reports.",
    },
    tags: ["Next.js", "TypeScript", "Agent", "pgvector"],
    repositoryUrl: "https://github.com/Ailian0206/evidence-graph",
  },
  {
    slug: "ai-photo-studio-cn",
    name: { zh: "AI Photo Studio CN", en: "AI Photo Studio CN" },
    status: "in-development",
    statusLabel: { zh: "持续开发", en: "In development" },
    summary: {
      zh: "面向中文写真、头像和社交内容的 AI 摄影棚，重点验证完整任务、Provider 安全门禁和失败恢复。",
      en: "An AI photo studio for Chinese portraits, avatars, and social content, focused on complete jobs, provider safety gates, and failure recovery.",
    },
    problem: {
      zh: "真实图像 Provider 昂贵且不稳定，人物训练照片又涉及隐私，普通 Demo 很难覆盖生产故障。",
      en: "Real image providers are costly and unreliable, training photos are private, and ordinary demos rarely cover production failure modes.",
    },
    approach: {
      zh: "建立 Mock 优先的生成闭环、付费调用二次确认、Provider 审计、重试链和隔离测试数据库。",
      en: "Built a mock-first generation loop, explicit paid-call confirmation, provider audit trails, retry chains, and an isolated test database.",
    },
    proof: {
      zh: "已跑通创建模型、上传训练照、生成任务、Gallery 下载和受控真实 Provider smoke。",
      en: "Validated model creation, training uploads, generation jobs, gallery downloads, and a gated real-provider smoke path.",
    },
    tags: ["Next.js", "Prisma", "Playwright", "Image API"],
    repositoryUrl: "https://github.com/Ailian0206/ai-photo-studio-cn",
  },
];

export function getProjectBySlug(slug: string) {
  return publicProjects.find((project) => project.slug === slug);
}
