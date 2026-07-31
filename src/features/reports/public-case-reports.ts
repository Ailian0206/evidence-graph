import type { PublicReport } from "./report-store";

const PUBLISHED_AT = "2026-07-31T02:00:00.000Z";

const createReport = ({
  id,
  slug,
  title,
  question,
  sections,
  citations,
}: {
  id: string;
  slug: string;
  title: string;
  question: string;
  sections: PublicReport["report"]["sections"];
  citations: PublicReport["report"]["citations"];
}): PublicReport => ({
  language: "zh",
  title,
  question,
  report: {
    id,
    slug,
    markdown: sections
      .map((section) => `## ${section.heading}\n\n${section.markdown}`)
      .join("\n\n"),
    sections,
    citations,
    version: 1,
    status: "published",
    publishedAt: PUBLISHED_AT,
  },
});

const cyberverseReport = createReport({
  id: "public_case_cyberverse",
  slug: "cyberverse-commercial-foundation-report",
  title: "CyberVerse 能否成为独立开发者的商业产品底座？",
  question: "独立开发者是否应该直接以 CyberVerse 为核心，开发并销售实时数字人产品？",
  sections: [
    {
      id: "cyberverse-capability",
      heading: "框架能力适合快速验证",
      factual: true,
      markdown:
        "CyberVerse 将自身定义为开源实时数字人 Agent 框架，并把 WebRTC、人物记忆、工具、RAG 和可选数字人视频作为核心能力。[cyberverse-readme-definition]\n\n它还把搜索、研究、资料整理、总结和 HTML 报告等长任务异步委托给后台 SubAgent，使前台 PersonaAgent 保持实时对话。[cyberverse-readme-subagents]",
      citationIds: ["cyberverse-readme-definition", "cyberverse-readme-subagents"],
    },
    {
      id: "cyberverse-operations",
      heading: "部署路径仍然偏工程化",
      factual: true,
      markdown:
        "本地前置条件横跨 Node、Go、Conda、Python、FFmpeg 与原生音频库，基础启动还需要分别运行 Python inference、Go API 和 frontend 三个终端。[cyberverse-readme-prerequisites]\n\n完整数字人视频会继续增加 CUDA 12.8、特定 PyTorch、视频编码与模型权重要求，因此产品体验目标会直接改变硬件与运维成本。[cyberverse-readme-avatar]",
      citationIds: ["cyberverse-readme-prerequisites", "cyberverse-readme-avatar"],
    },
    {
      id: "cyberverse-license",
      heading: "GPLv3 是独立的商业门禁",
      factual: true,
      markdown:
        "仓库使用 GNU GPL version 3。许可证文本说明它旨在保证所有版本都保持自由软件，并在分发时要求接收者获得同样的自由与源码获取方式。[cyberverse-license-gpl]\n\n因此结论不是“不能商用”，而是先把预期托管、镜像交付或修改版分发方式交给专业法律审查，再决定是否长期维护深度分叉。[cyberverse-license-gpl]",
      citationIds: ["cyberverse-license-gpl"],
    },
    {
      id: "cyberverse-decision",
      heading: "决策：有条件采用",
      factual: true,
      markdown:
        "现阶段把 CyberVerse 用作技术验证和可替换组件库：先关闭本地 Avatar，完成语音优先的单机封装、并发与成本测量，再处理 GPLv3 合规。只有这些门禁通过后，才把它升级为商业产品核心。[cyberverse-readme-voice-only]\n\n本结论没有运行完整数字人模型或生产并发压测，也不构成法律意见；它保留了快速验证的收益，同时不把功能覆盖误写成生产确定性。[cyberverse-readme-avatar]",
      citationIds: ["cyberverse-readme-voice-only", "cyberverse-readme-avatar"],
    },
  ],
  citations: [
    {
      evidenceLinkId: "cyberverse-readme-definition",
      claimId: "cyberverse-claim-capability",
      chunkId: "cyberverse-readme-intro",
      sourceId: "cyberverse-readme",
      quote:
        "CyberVerse is an open-source real-time digital-human Agent framework. It uses WebRTC, persona memory, tools, RAG, and optional digital-human video capabilities to help you build AI agents centered on voice interaction.",
      sourceUrl:
        "https://github.com/Lynpoint/CyberVerse/blob/4e2585a7fe5005b6089c7bfa5df1f5beb1ec8ef1/README.md",
      sourceTitle: "CyberVerse README at commit 4e2585a",
    },
    {
      evidenceLinkId: "cyberverse-readme-subagents",
      claimId: "cyberverse-claim-capability",
      chunkId: "cyberverse-readme-subagents",
      sourceId: "cyberverse-readme",
      quote:
        "long-running work such as search, research, material organization, summarization, and HTML report generation is delegated to background SubAgents asynchronously.",
      sourceUrl:
        "https://github.com/Lynpoint/CyberVerse/blob/4e2585a7fe5005b6089c7bfa5df1f5beb1ec8ef1/README.md#personaagent--subagent-tasks",
      sourceTitle: "CyberVerse PersonaAgent and SubAgent architecture",
    },
    {
      evidenceLinkId: "cyberverse-readme-prerequisites",
      claimId: "cyberverse-claim-operations",
      chunkId: "cyberverse-readme-startup",
      sourceId: "cyberverse-readme",
      quote:
        "Node 18+\nGo 1.25 (required: protoc-gen-go, protoc-gen-go-grpc)\nConda\nPython 3.10+\nFFmpeg",
      sourceUrl:
        "https://github.com/Lynpoint/CyberVerse/blob/4e2585a7fe5005b6089c7bfa5df1f5beb1ec8ef1/README.md#prerequisites",
      sourceTitle: "CyberVerse local prerequisites and startup guide",
    },
    {
      evidenceLinkId: "cyberverse-readme-avatar",
      claimId: "cyberverse-claim-operations",
      chunkId: "cyberverse-readme-avatar",
      sourceId: "cyberverse-readme",
      quote:
        "GPU with CUDA 12.8+\nPyTorch 2.8 (CUDA 12.8)\nFFmpeg with libvpx for video encoding\nAvatar model weights",
      sourceUrl:
        "https://github.com/Lynpoint/CyberVerse/blob/4e2585a7fe5005b6089c7bfa5df1f5beb1ec8ef1/README.md#optional-full-digital-human-video",
      sourceTitle: "CyberVerse full digital-human video requirements",
    },
    {
      evidenceLinkId: "cyberverse-license-gpl",
      claimId: "cyberverse-claim-license",
      chunkId: "cyberverse-license-preamble",
      sourceId: "cyberverse-license",
      quote:
        "The GNU General Public License is a free, copyleft license for software and other kinds of works.",
      sourceUrl:
        "https://github.com/Lynpoint/CyberVerse/blob/4e2585a7fe5005b6089c7bfa5df1f5beb1ec8ef1/LICENSE",
      sourceTitle: "CyberVerse GNU General Public License v3",
    },
    {
      evidenceLinkId: "cyberverse-readme-voice-only",
      claimId: "cyberverse-claim-decision",
      chunkId: "cyberverse-readme-voice-only",
      sourceId: "cyberverse-readme",
      quote:
        "For pure voice sessions, no local avatar GPU is required. Runtime cost depends on the realtime voice/omni/LLM/TTS/ASR providers you configure.",
      sourceUrl:
        "https://github.com/Lynpoint/CyberVerse/blob/4e2585a7fe5005b6089c7bfa5df1f5beb1ec8ef1/README.md#prerequisites",
      sourceTitle: "CyberVerse voice-only runtime note",
    },
  ],
});

const comparisonReport = createReport({
  id: "public_case_evidence_graph_comparison",
  slug: "evidence-graph-vs-ai-search-report",
  title: "Evidence Graph 与普通 AI 搜索总结有什么不同？",
  question: "当普通 AI 搜索也能提供链接时，Evidence Graph 是否仍提供足够明确的产品价值？",
  sections: [
    {
      id: "comparison-model",
      heading: "比较单位不是回答，而是研究对象",
      factual: true,
      markdown:
        "Evidence Graph 的公开产品定义把搜索结果拆成 Claim、Evidence 与 Source，并显式保存支持、反驳、限定和冲突关系。[comparison-product-definition]\n\n其闭环还要求用户逐条接受或拒绝主张，再生成带引用报告；这与一次性自然语言总结的主要差异是对象可审核、关系可定位、记录可保留。[comparison-product-workflow]",
      citationIds: ["comparison-product-definition", "comparison-product-workflow"],
    },
    {
      id: "comparison-constraints",
      heading: "引用必须落到精确片段",
      factual: true,
      markdown:
        "产品约束要求 Quote 必须是保存正文的精确子串，否则 Evidence Link 拒绝入库；事实型报告段落没有 Citation 也不能发布。[comparison-correctness]\n\n反驳证据不会在综合过程中被静默删除，因此错误或分歧可以落到具体 Claim、Evidence Link 和 Citation，而不是只剩一段无法拆解的答案。[comparison-correctness]",
      citationIds: ["comparison-correctness"],
    },
    {
      id: "comparison-measurement",
      heading: "C4 已把可追溯性变成质量门禁",
      factual: true,
      markdown:
        "C4 最终真实批次达到 65/65 条精确 Quote、无引用事实段落 0、二十条关系抽查正确十九条，并完成十个固定问题。[comparison-c4-result]\n\n门禁同时要求至少九成可用案例覆盖不少于两个 Evidence 来源域名；最终九个案例达到该要求，说明来源覆盖和关系质量被分别测量，而不是合并成一个不透明分数。[comparison-c4-coverage]",
      citationIds: ["comparison-c4-result", "comparison-c4-coverage"],
    },
    {
      id: "comparison-decision",
      heading: "决策：聚焦审核与证据交付",
      factual: true,
      markdown:
        "Evidence Graph 应继续服务需要核验和交付依据的技术、产品与市场研究，而不是通过通用聊天去竞争最快回答。公开报告、原文引用与失败修正记录是核心产物。[comparison-readme]\n\nC4 只证明固定题集上的约束可执行，不证明所有结论永远正确，也不比较所有通用搜索产品的召回、写作或速度。[comparison-c4-result]",
      citationIds: ["comparison-readme", "comparison-c4-result"],
    },
  ],
  citations: [
    {
      evidenceLinkId: "comparison-product-definition",
      claimId: "comparison-claim-model",
      chunkId: "comparison-product-definition",
      sourceId: "comparison-product-plan",
      quote:
        "Evidence Graph 是一个“可追溯的 AI 研究工作台”：它把搜索结果拆成 Claim、Evidence 和 Source，并明确标记支持、反驳、限定和冲突关系。",
      sourceUrl:
        "https://github.com/Ailian0206/evidence-graph/blob/0afdb9ea5b6ab5da909a377c675fa1a25a71de2c/docs/product-plan.md#31-%E4%B8%80%E5%8F%A5%E8%AF%9D%E5%AE%9A%E4%B9%89",
      sourceTitle: "Evidence Graph product definition",
    },
    {
      evidenceLinkId: "comparison-product-workflow",
      claimId: "comparison-claim-model",
      chunkId: "comparison-product-workflow",
      sourceId: "comparison-product-plan",
      quote: "展示支持、反驳和限定关系\n→ 人工接受或拒绝\n→ 生成带引用报告\n→ 发布只读分享页",
      sourceUrl:
        "https://github.com/Ailian0206/evidence-graph/blob/0afdb9ea5b6ab5da909a377c675fa1a25a71de2c/docs/product-plan.md#33-%E6%A0%B8%E5%BF%83%E4%BB%BB%E5%8A%A1",
      sourceTitle: "Evidence Graph core research workflow",
    },
    {
      evidenceLinkId: "comparison-correctness",
      claimId: "comparison-claim-correctness",
      chunkId: "comparison-product-constraints",
      sourceId: "comparison-product-plan",
      quote:
        "quote 必须是保存正文的精确子串，否则 Evidence Link 拒绝入库。\n一个事实型报告段落没有 Citation 就不能发布。\n“反驳”证据不会被综合过程静默删除。",
      sourceUrl:
        "https://github.com/Ailian0206/evidence-graph/blob/0afdb9ea5b6ab5da909a377c675fa1a25a71de2c/docs/product-plan.md#73-%E5%85%B3%E9%94%AE%E6%AD%A3%E7%A1%AE%E6%80%A7%E7%BA%A6%E6%9D%9F",
      sourceTitle: "Evidence Graph correctness constraints",
    },
    {
      evidenceLinkId: "comparison-c4-result",
      claimId: "comparison-claim-measurement",
      chunkId: "comparison-c4-status",
      sourceId: "comparison-project-status",
      quote:
        "C4 新口径 6/6 通过 | 65/65 精确引用、无引用事实段落 0、关系 19/20、至少二域 9/10、完成 10/10、单题最高 `0.02009 USD`",
      sourceUrl:
        "https://github.com/Ailian0206/evidence-graph/blob/0afdb9ea5b6ab5da909a377c675fa1a25a71de2c/PROJECT_STATUS.md#%E7%9C%9F%E5%AE%9E%E5%AE%8C%E6%88%90%E5%BA%A6",
      sourceTitle: "Evidence Graph C4 measured result",
    },
    {
      evidenceLinkId: "comparison-c4-coverage",
      claimId: "comparison-claim-measurement",
      chunkId: "comparison-c4-coverage",
      sourceId: "comparison-project-status",
      quote:
        "至少 90% 的可用完成案例覆盖不少于 2 个 Evidence domains",
      sourceUrl:
        "https://github.com/Ailian0206/evidence-graph/blob/0afdb9ea5b6ab5da909a377c675fa1a25a71de2c/PROJECT_STATUS.md#%E6%9C%80%E8%BF%91%E9%AA%8C%E8%AF%81%E5%9F%BA%E7%BA%BF",
      sourceTitle: "Evidence Graph C4 source-domain gate",
    },
    {
      evidenceLinkId: "comparison-readme",
      claimId: "comparison-claim-decision",
      chunkId: "comparison-readme-intro",
      sourceId: "comparison-readme",
      quote:
        "它把研究问题转换为持久化的来源、主张、证据关系、冲突和带引文报告，读者可以逐层检查到原始证据片段。",
      sourceUrl:
        "https://github.com/Ailian0206/evidence-graph/blob/0afdb9ea5b6ab5da909a377c675fa1a25a71de2c/README.md",
      sourceTitle: "Evidence Graph README",
    },
  ],
});

const infrastructureReport = createReport({
  id: "public_case_long_running_infrastructure",
  slug: "long-running-ai-infrastructure-report",
  title: "Vercel、Railway、Cloudflare：长时 AI 研究工作流怎么选？",
  question: "长时、可重试、有状态研究任务应继续放在 Vercel，迁移 Railway，还是改写到 Cloudflare？",
  sections: [
    {
      id: "infrastructure-vercel",
      heading: "Vercel 的函数限制与工作流能力必须分开",
      factual: true,
      markdown:
        "Vercel Functions 在 Fluid compute 下，Hobby 最大持续三百秒，Pro 和 Enterprise 常规最大八百秒，扩展 Beta 最大一千八百秒。[infrastructure-vercel-limits]\n\nVercel Workflows 则能暂停数分钟或数月并从原位置恢复，因此 Vercel 技术上可以承载耐久任务，但从现有 Inngest 迁移会改变 SDK、事件和观测方式。[infrastructure-vercel-workflows]",
      citationIds: ["infrastructure-vercel-limits", "infrastructure-vercel-workflows"],
    },
    {
      id: "infrastructure-railway",
      heading: "Railway 最贴近现有常驻 worker",
      factual: true,
      markdown:
        "Railway 将 Service 定义为容器部署目标，并明确把 Persistent Service 描述为始终运行，适用于 Web、后端 API、消息队列和数据库服务。[infrastructure-railway-services]\n\n默认重启策略是 On Failure，最多十次；付费计划可设置任意策略与重启次数。它不替代业务幂等，但能用较少改写托管现有 Inngest worker。[infrastructure-railway-restarts]",
      citationIds: ["infrastructure-railway-services", "infrastructure-railway-restarts"],
    },
    {
      id: "infrastructure-cloudflare",
      heading: "Cloudflare 需要区分 Worker 与 Workflows",
      factual: true,
      markdown:
        "普通 Cloudflare Worker 的付费 CPU 时间可从默认三十秒提高到五分钟，每个 isolate 内存上限为 128 MB；客户端断开后，waitUntil 最多再延长三十秒。[infrastructure-cloudflare-workers]\n\nCloudflare Workflows 的每个步骤可以拥有不受限的墙钟时间，但仍受配置的 CPU 时间限制；实例只要没有耗尽步骤和 CPU 门限就能长期运行。[infrastructure-cloudflare-workflows]",
      citationIds: ["infrastructure-cloudflare-workers", "infrastructure-cloudflare-workflows"],
    },
    {
      id: "infrastructure-decision",
      heading: "决策：Web 与执行层分开部署",
      factual: true,
      markdown:
        "当前采用 Vercel 承载作品集、Next.js Web 与短 API，Railway Persistent Service 运行现有 Inngest worker。这个选择保留已经验证的任务语义，同时把函数持续时间从执行层故障模型中移除。[infrastructure-railway-services]\n\n初稿曾因函数时限排除 Vercel；加入 Vercel Workflows 后修正为“可行但改写较多”。Cloudflare Workflows 同样可行，但在出现明确的边缘耐久编排需求前，不为统一平台提前重写。[infrastructure-vercel-workflows] [infrastructure-cloudflare-workflows]",
      citationIds: [
        "infrastructure-railway-services",
        "infrastructure-vercel-workflows",
        "infrastructure-cloudflare-workflows",
      ],
    },
  ],
  citations: [
    {
      evidenceLinkId: "infrastructure-vercel-limits",
      claimId: "infrastructure-claim-vercel",
      chunkId: "infrastructure-vercel-limit-table",
      sourceId: "infrastructure-vercel-docs",
      quote:
        "Hobby: 300s default and maximum. Pro and Enterprise: 300s default, 800s maximum, and 1800s extended maximum",
      sourceUrl: "https://vercel.com/docs/functions/limitations#max-duration",
      sourceTitle: "Vercel Functions limits",
    },
    {
      evidenceLinkId: "infrastructure-vercel-workflows",
      claimId: "infrastructure-claim-vercel",
      chunkId: "infrastructure-vercel-workflow-resume",
      sourceId: "infrastructure-vercel-workflow-docs",
      quote: "Pause for minutes or months, then resume from the exact point.",
      sourceUrl: "https://vercel.com/docs/workflows",
      sourceTitle: "Vercel Workflows",
    },
    {
      evidenceLinkId: "infrastructure-railway-services",
      claimId: "infrastructure-claim-railway",
      chunkId: "infrastructure-railway-persistent",
      sourceId: "infrastructure-railway-docs",
      quote:
        "A Railway service is a deployment target. Under the hood, services are containers deployed from an image.\n\nPersistent services\n\nServices that are always running.",
      sourceUrl: "https://docs.railway.com/services",
      sourceTitle: "Railway Services",
    },
    {
      evidenceLinkId: "infrastructure-railway-restarts",
      claimId: "infrastructure-claim-railway",
      chunkId: "infrastructure-railway-restarts",
      sourceId: "infrastructure-railway-restart-docs",
      quote:
        "The default is `On Failure` with a maximum of 10 restarts.",
      sourceUrl: "https://docs.railway.com/deployments/restart-policy",
      sourceTitle: "Railway Restart Policy",
    },
    {
      evidenceLinkId: "infrastructure-cloudflare-workers",
      claimId: "infrastructure-claim-cloudflare",
      chunkId: "infrastructure-cloudflare-worker-limits",
      sourceId: "infrastructure-cloudflare-worker-docs",
      quote:
        "On the Workers Paid plan, you can increase the maximum CPU time from the default 30 seconds to 5 minutes (300,000 ms).",
      sourceUrl: "https://developers.cloudflare.com/workers/platform/limits/#cpu-time",
      sourceTitle: "Cloudflare Workers platform limits",
    },
    {
      evidenceLinkId: "infrastructure-cloudflare-workflows",
      claimId: "infrastructure-claim-cloudflare",
      chunkId: "infrastructure-cloudflare-workflow-duration",
      sourceId: "infrastructure-cloudflare-workflow-docs",
      quote:
        "Each step can run for an unlimited wall time. Individual steps are subject to the configured CPU time limit.",
      sourceUrl: "https://developers.cloudflare.com/workflows/reference/limits/",
      sourceTitle: "Cloudflare Workflows limits",
    },
  ],
});

export const publicCaseReports: PublicReport[] = [
  cyberverseReport,
  comparisonReport,
  infrastructureReport,
];

export function findPublicCaseReport(slug: string) {
  return publicCaseReports.find((report) => report.report.slug === slug);
}
