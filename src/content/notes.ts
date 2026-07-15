import type { PracticeNote } from "./types";

export const notes: PracticeNote[] = [
  {
    slug: "why-evidence-graph",
    title: {
      zh: "为什么普通 AI 搜索总结还不够",
      en: "Why ordinary AI search summaries are not enough",
    },
    summary: {
      zh: "从一次性回答转向可审核、可版本化的证据项目。",
      en: "Moving from one-off answers to reviewable, versioned evidence projects.",
    },
    status: "draft",
    date: "2026-07-15",
  },
  {
    slug: "cyberverse-review",
    title: {
      zh: "CyberVerse：技术原型与生产底座之间",
      en: "CyberVerse: between technical prototype and production foundation",
    },
    summary: {
      zh: "从代码、测试、部署和安全边界审视一个实时数字人 Agent 项目。",
      en: "Reviewing a realtime digital-human Agent project through code, tests, deployment, and security boundaries.",
    },
    status: "research",
    date: "2026-07-14",
  },
  {
    slug: "safe-paid-provider-tests",
    title: {
      zh: "如何让付费 AI Provider 测试保持有界",
      en: "Keeping paid AI provider tests bounded",
    },
    summary: {
      zh: "Mock 默认、确认口令、预算限制和可审计失败路径。",
      en: "Mock defaults, confirmation tokens, budget limits, and auditable failure paths.",
    },
    status: "draft",
    date: "2026-07-15",
  },
];
