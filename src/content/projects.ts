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
  {
    slug: "mcp-guardian",
    name: { zh: "MCP Guardian", en: "MCP Guardian" },
    status: "in-development",
    statusLabel: { zh: "MVP 就绪", en: "MVP ready" },
    summary: {
      zh: "在 Agent 调用 MCP 工具之前执行 allow / deny / redact / require_approval，并留下可回放审计。",
      en: "A pre-call policy gateway for MCP tool calls—allow, deny, redact, or require approval—with replayable audits.",
    },
    problem: {
      zh: "Trace 平台擅长事后观测，但拦不住一次危险的 shell、越权读系统文件，或把密钥打进 HTTP 参数。",
      en: "Trace platforms observe after the fact, but cannot stop a dangerous shell command, path escape, or secrets in HTTP args.",
    },
    approach: {
      zh: "YAML 策略引擎 + 本地 Gateway 代理 tools/call，默认 fail-closed，并提供 CLI 与 Web 两条审批路径。",
      en: "YAML policy engine plus a local gateway proxying tools/call, fail-closed by default, with CLI and web approval paths.",
    },
    proof: {
      zh: "A1–A8 与 6 个红队场景脚本可重复通过；公开 /demo 与 Playwright smoke 已覆盖。",
      en: "Repeatable A1–A8 and six red-team scenarios; public /demo and Playwright smoke are green.",
    },
    tags: ["TypeScript", "MCP", "Policy", "Playwright"],
    repositoryUrl: "https://github.com/Ailian0206/mcp-guardian",
  },
];

export function getProjectBySlug(slug: string) {
  return publicProjects.find((project) => project.slug === slug);
}
