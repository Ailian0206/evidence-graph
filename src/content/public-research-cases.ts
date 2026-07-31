import type { LocalizedText } from "./types";

export type PublicCaseGraphNode = {
  id: string;
  type: "source" | "evidence" | "claim" | "decision";
  label: LocalizedText;
  detail: LocalizedText;
};

export type PublicCaseGraphEdge = {
  id: string;
  from: string;
  to: string;
};

export type PublicResearchCase = {
  slug: string;
  reportSlug: string;
  reportLanguage: "zh" | "en";
  publishedAt: string;
  researchedAt: string;
  sourceCount: number;
  title: LocalizedText;
  summary: LocalizedText;
  question: LocalizedText;
  scope: LocalizedText;
  decision: LocalizedText;
  limitations: LocalizedText[];
  failure: {
    what: LocalizedText;
    correction: LocalizedText;
  };
  article: Array<{
    heading: LocalizedText;
    paragraphs: LocalizedText[];
  }>;
  graph: {
    nodes: PublicCaseGraphNode[];
    edges: PublicCaseGraphEdge[];
  };
};

export const publicResearchCases: PublicResearchCase[] = [
  {
    slug: "cyberverse-commercial-foundation",
    reportSlug: "cyberverse-commercial-foundation-report",
    reportLanguage: "zh",
    publishedAt: "2026-07-31T02:00:00.000Z",
    researchedAt: "2026-07-31",
    sourceCount: 2,
    title: {
      zh: "CyberVerse 能否成为独立开发者的商业产品底座？",
      en: "Can CyberVerse be a commercial product foundation for an independent developer?",
    },
    summary: {
      zh: "它是一套能力完整、测试充分的实时数字人 Agent 框架，但产品化前必须先解决部署复杂度、硬件成本和 GPLv3 合规边界。",
      en: "It is a capable, well-tested realtime digital-human Agent framework, but deployment complexity, hardware cost, and GPLv3 obligations must be resolved before productization.",
    },
    question: {
      zh: "独立开发者是否应该直接以 CyberVerse 为核心，开发并销售实时数字人产品？",
      en: "Should an independent developer build and sell a realtime digital-human product directly on CyberVerse?",
    },
    scope: {
      zh: "基于 2026-07-31 检查的上游提交 4e2585a，评估能力覆盖、启动路径、测试资产、GPU 要求与许可证；不包含真实并发压测和商业法律意见。",
      en: "The review inspects upstream commit 4e2585a on 2026-07-31 for capability coverage, startup path, tests, GPU requirements, and licensing; it excludes production load tests and legal advice.",
    },
    decision: {
      zh: "有条件采用：先把它作为技术验证和可替换组件库，不直接承诺为商业 SaaS 的生产底座；完成单机部署、成本压测与 GPLv3 法律审查后再决定是否深度分叉。",
      en: "Adopt conditionally as a technical validation base and replaceable component library, not yet as the promised production core of a commercial SaaS; decide on a deeper fork only after single-host packaging, cost tests, and GPLv3 legal review.",
    },
    limitations: [
      {
        zh: "本次没有运行完整数字人模型，也没有测量 GPU 时延、并发、云端账单或第三方语音服务稳定性。",
        en: "This review did not run the full avatar models or measure GPU latency, concurrency, cloud bills, or third-party voice reliability.",
      },
      {
        zh: "许可证结论仅用于识别产品风险，不能替代针对分发方式、网络服务和修改范围的专业法律意见。",
        en: "The license conclusion identifies product risk only and does not replace legal advice about distribution, hosted access, or modifications.",
      },
    ],
    failure: {
      what: {
        zh: "最初只看到实时语音、RAG、数字人和大量测试，容易把“功能覆盖广”直接等同为“可立即商业化”。",
        en: "The first pass overemphasized realtime voice, RAG, avatar features, and the large test suite, treating broad capability as immediate commercial readiness.",
      },
      correction: {
        zh: "把结论拆成能力、运维和合规三条证据链后，三终端启动、CUDA/模型权重要求和 GPLv3 成为独立门禁，最终决策改为有条件采用。",
        en: "Separating capability, operations, and compliance exposed the three-terminal startup, CUDA/model-weight requirements, and GPLv3 as independent gates, changing the decision to conditional adoption.",
      },
    },
    article: [
      {
        heading: { zh: "先定义“底座”", en: "Define foundation before judging it" },
        paragraphs: [
          {
            zh: "判断一个开源项目能否成为商业产品底座，不能只问功能是否足够。对独立开发者而言，底座还意味着能用有限时间完成部署、升级、故障定位和成本控制，并且许可证不会让预期的交付方式突然失效。CyberVerse 的功能表很有吸引力：实时语音交互、可中断对话、人物记忆、RAG、工具系统，以及可选的数字人视频，都直接接近一个可演示产品。但演示能力只是第一层证据，商业承诺需要另外两层：可重复运维与清晰合规。",
            en: "A commercial foundation is more than a feature checklist. For an independent developer it must also be deployable, upgradeable, diagnosable, cost-bounded, and compatible with the intended distribution model. CyberVerse is compelling because realtime voice, interruptions, memory, RAG, tools, and optional avatar video already resemble a product, but operational and licensing evidence must be judged separately.",
          },
          {
            zh: "因此这次研究没有把问题写成“CyberVerse 好不好”，而是限定为：一个人能否在可控风险下，以它为核心开发并销售服务。研究固定在上游提交 4e2585a，检查 README、许可证和仓库测试结构。这样做避免把后续变化混入结论，也避免用 Star 数或宣传视频替代工程事实。结论所说的“采用”也不是整仓复制，而是从技术验证开始，保留替换边界，只有门禁通过后才承担长期分叉成本。",
            en: "The question is therefore not whether CyberVerse is good, but whether one developer can safely build and sell around it. The review freezes upstream commit 4e2585a and inspects its README, license, and test structure instead of using popularity or demos as proxies. Adoption begins as a bounded technical validation, with replacement boundaries retained until the production gates pass.",
          },
        ],
      },
      {
        heading: { zh: "能力证据足够强", en: "The capability evidence is strong" },
        paragraphs: [
          {
            zh: "从架构描述看，PersonaAgent 负责前台低延迟对话，把搜索、研究、资料整理、总结和 HTML 报告等长任务异步交给后台 SubAgent。这不是简单的聊天界面包装，而是已经考虑实时交互与慢任务隔离。模块化的语音、听觉、工具、记忆和数字人组件，也为替换供应商留下了入口。对于需要快速验证“数字人加 Agent”体验的个人开发者，这能显著减少从零连接 WebRTC、语音链和任务编排的时间。",
            en: "The architecture separates low-latency PersonaAgent conversation from asynchronous SubAgent work such as search, research, organization, summarization, and report generation. Replaceable voice, hearing, tool, memory, and avatar modules further reduce the time needed to validate a digital-human Agent experience.",
          },
          {
            zh: "仓库并非只有概念代码。检查到的 Go 服务、Python 推理模块与集成目录包含大量测试，覆盖会话编排、WebRTC 媒体、RAG、插件发现、语音模型和数字人路径。这些测试不能证明线上可用性，却说明作者已经把不少关键行为当作可回归契约。对接手者而言，它降低了修改后完全失去反馈的风险，也使“先裁剪为纯语音版本，再逐步增加视频能力”成为现实路线。",
            en: "The repository includes substantial Go, Python, and integration tests across orchestration, WebRTC media, RAG, plugin discovery, voice models, and avatar paths. Tests do not prove production readiness, but they provide useful regression contracts and make a voice-first reduction more credible.",
          },
        ],
      },
      {
        heading: { zh: "产品化成本在运维侧", en: "Productization cost sits in operations" },
        paragraphs: [
          {
            zh: "本地快速启动仍要求 Node、Go、Conda、Python、FFmpeg 和多项原生库，基础模式需要分别启动 Python 推理服务、Go API 与前端三个终端。这对维护者可接受，但对一键部署、自动扩缩和故障恢复并不友好。每多一种运行时，就多一套构建缓存、漏洞更新、日志和健康检查。独立开发者若直接把整套系统推向 SaaS，最先消耗的往往不是模型能力，而是持续集成、镜像体积和跨语言故障定位时间。",
            en: "Local setup spans Node, Go, Conda, Python, FFmpeg, native libraries, and three running services. That is manageable for a maintainer but expensive for one-click deployment, autoscaling, health checks, security updates, and cross-runtime incident diagnosis.",
          },
          {
            zh: "完整数字人视频又增加 CUDA 12.8、特定 PyTorch 版本、视频编码能力和模型权重。README 给出的高质量实时示例依赖高端 GPU，这意味着体验目标会直接决定毛利和并发策略。更稳妥的第一阶段是关闭本地 Avatar，使用纯语音或云端数字人接口，先测量单会话时长、首包延迟和失败率。只有当用户价值能够覆盖 GPU 与第三方 Provider 成本时，才值得把本地视频模型纳入核心部署。",
            en: "Full avatar video adds CUDA 12.8, pinned PyTorch, video encoding, model weights, and high-end GPU expectations. A safer first phase disables local avatars, validates voice or cloud-avatar paths, and measures latency, session cost, and failure rate before making local video inference core infrastructure.",
          },
        ],
      },
      {
        heading: { zh: "有条件采用，而非直接押注", en: "Conditional adoption, not a full bet" },
        paragraphs: [
          {
            zh: "最后一条门禁是 GPLv3。它明确允许使用、修改和再分发，但分发派生程序时会带来对应的源码与同许可证义务。具体产品是托管服务、交付镜像还是向客户分发修改版，会改变需要评估的风险。这不是判定项目“不能商用”，而是说明商业模型必须在编码前和法律意见对齐。若核心价值依赖闭源修改并向客户交付，许可证可能成为结构性约束；若主要提供托管服务和独立数据能力，风险形态又不同。",
            en: "GPLv3 permits use, modification, and redistribution while imposing source and same-license obligations in relevant distribution scenarios. Hosted service, delivered image, and modified customer distribution models create different risks, so the intended commercial model needs legal review before deep integration.",
          },
          {
            zh: "综合三条证据链，CyberVerse 值得用来缩短技术验证，却还不适合被无条件写进商业路线图。下一步应建立可重复的单机容器部署，裁剪为语音优先版本，记录真实并发和单会话成本，同时让律师审查预期分发方式。通过这些门禁后，可以继续维护分叉；如果失败，已验证的 WebRTC、Agent 分工和插件思路仍可迁移到更小的自有架构。这个决策保留了速度，也避免把展示效果误认为生产确定性。",
            en: "CyberVerse can accelerate technical validation but should not yet become an unconditional commercial commitment. The next gates are reproducible single-host packaging, a voice-first reduction, measured concurrency and session cost, and legal review. Passing them supports a maintained fork; failing them still leaves reusable architectural lessons.",
          },
        ],
      },
    ],
    graph: {
      nodes: [
        {
          id: "cyberverse-source",
          type: "source",
          label: { zh: "CyberVerse README", en: "CyberVerse README" },
          detail: {
            zh: "固定提交 4e2585a，包含启动、架构与 GPU 要求。",
            en: "Pinned commit 4e2585a documents architecture, startup, and GPU requirements.",
          },
        },
        {
          id: "cyberverse-evidence",
          type: "evidence",
          label: { zh: "三服务启动 + GPU 可选层", en: "Three services plus an optional GPU layer" },
          detail: {
            zh: "基础运行跨 Python、Go 与前端；完整视频另需 CUDA 和模型权重。",
            en: "Base operation spans Python, Go, and frontend services; full video adds CUDA and model weights.",
          },
        },
        {
          id: "cyberverse-claim",
          type: "claim",
          label: { zh: "能力成熟度高于部署成熟度", en: "Capability maturity exceeds deployment maturity" },
          detail: {
            zh: "适合快速验证，不足以直接承诺低运维的商业 SaaS。",
            en: "It suits rapid validation but does not yet justify a low-operations SaaS commitment.",
          },
        },
        {
          id: "cyberverse-decision",
          type: "decision",
          label: { zh: "有条件采用", en: "Conditional adoption" },
          detail: {
            zh: "先做语音优先封装、成本压测与 GPLv3 审查。",
            en: "First complete voice-first packaging, cost tests, and GPLv3 review.",
          },
        },
      ],
      edges: [
        { id: "cyberverse-edge-1", from: "cyberverse-source", to: "cyberverse-evidence" },
        { id: "cyberverse-edge-2", from: "cyberverse-evidence", to: "cyberverse-claim" },
        { id: "cyberverse-edge-3", from: "cyberverse-claim", to: "cyberverse-decision" },
      ],
    },
  },
  {
    slug: "evidence-graph-vs-ai-search",
    reportSlug: "evidence-graph-vs-ai-search-report",
    reportLanguage: "zh",
    publishedAt: "2026-07-31T02:05:00.000Z",
    researchedAt: "2026-07-30",
    sourceCount: 3,
    title: {
      zh: "Evidence Graph 与普通 AI 搜索总结有什么不同？",
      en: "How does Evidence Graph differ from ordinary AI search summaries?",
    },
    summary: {
      zh: "差异不在答案更长，而在研究对象被保存为可审核的 Source、Evidence、Claim、关系与不可变报告；C4 实测说明这些约束已经可度量。",
      en: "The difference is not a longer answer but a persisted, reviewable model of Sources, Evidence, Claims, relations, and immutable reports; C4 shows those constraints can be measured.",
    },
    question: {
      zh: "当普通 AI 搜索也能提供链接时，Evidence Graph 是否仍提供足够明确的产品价值？",
      en: "When ordinary AI search can also provide links, does Evidence Graph still offer a distinct product value?",
    },
    scope: {
      zh: "比较一次性搜索总结与本仓库已经实现并通过 C4 评测的可追溯工作流；结论聚焦核验、审核、冲突保留和发布，不比较模型回答风格或搜索覆盖率。",
      en: "The comparison focuses on verification, human review, preserved conflicts, and publication in the implemented workflow that passed C4; it does not rank model prose style or search recall.",
    },
    decision: {
      zh: "继续把 Evidence Graph 定位为研究审核与证据交付工具，而不是另一个搜索输入框；核心指标应是引用可核查性、关系准确率和报告可审计性，不是首屏回答速度。",
      en: "Keep Evidence Graph positioned as a research review and evidence-delivery tool, not another search box; optimize for citation verifiability, relation accuracy, and report auditability rather than first-answer speed.",
    },
    limitations: [
      {
        zh: "C4 评测验证了固定十题和人工抽样，不代表所有主题、语言和网页结构都能达到同等质量。",
        en: "C4 validates a fixed ten-question set and human sample, not identical quality across every topic, language, or web structure.",
      },
      {
        zh: "本案例比较的是产物和审核流程，不声称 Evidence Graph 的搜索召回、写作质量或端到端速度优于所有通用 AI 搜索产品。",
        en: "This case compares artifacts and review workflow; it does not claim superior search recall, prose quality, or end-to-end speed over every general AI search product.",
      },
    ],
    failure: {
      what: {
        zh: "早期把“有引用”当作主要差异，但普通 AI 搜索同样可以列出来源，单靠链接数量不足以建立产品边界。",
        en: "The initial framing treated citations as the main differentiator, even though ordinary AI search can also list sources; link count alone did not establish a product boundary.",
      },
      correction: {
        zh: "把比较单位从答案页面改为可持久化研究对象，并用 C4 的精确 Quote、事实段落引用和 Evidence Relation 指标验证，差异收敛为可审核、可纠错、可交付。",
        en: "Changing the comparison unit from answer page to persisted research object, then checking exact quotes, factual-paragraph citations, and Evidence Relation metrics, clarified the value as reviewability, correction, and delivery.",
      },
    },
    article: [
      {
        heading: { zh: "“带链接”不是终点", en: "Links are not the finish line" },
        paragraphs: [
          {
            zh: "普通 AI 搜索已经能在回答旁边列出网页，因此 Evidence Graph 不能把“我也有引用”当作独特价值。真正的问题是：读者能否知道某个事实句究竟由哪段原文支持，引用是支持、反驳还是仅提供背景，以及人在修改结论后是否还能看到模型最初生成了什么。页面级链接解决的是发现来源，不能自动解决论证结构、精确核验和后续审计。若产品只把同一批链接换一种排版，用户没有理由承担更复杂的工作流。",
            en: "Ordinary AI search can already place web links beside an answer, so citation presence alone is not differentiation. The harder questions are which exact excerpt supports a fact, whether evidence supports or contradicts it, and whether the original model record survives human edits. Page links aid discovery but do not automatically provide an auditable argument structure.",
          },
          {
            zh: "Evidence Graph 因而把研究结果拆成多个持久对象：Source 保存来源元数据和正文，Chunk 固定可引用片段，Claim 表示独立且可证伪的主张，Evidence Link 记录片段与主张之间的支持或反驳关系，报告则保存发布时的引用快照。这个模型的成本是界面更重、生成更慢、需要人工审核；收益是每一层都能单独检查，也能在问题变化时保留之前的来源、关系与审核记录。",
            en: "Evidence Graph persists Sources, citable Chunks, falsifiable Claims, typed Evidence Links, and publication snapshots. This costs more interaction and time than a single answer, but each layer can be inspected and preserved across revisions.",
          },
        ],
      },
      {
        heading: { zh: "审核对象必须独立", en: "Review needs independent objects" },
        paragraphs: [
          {
            zh: "自然语言总结把多个判断压进连续段落。即使段尾有三个链接，审核者也难以判断每个链接对应哪句话，更难发现同一段里混入了范围不同或互相冲突的说法。把 Claim 独立成数据实体后，用户可以逐条接受、拒绝或保留待确认；拒绝不会删除原始记录，后续报告只使用满足审核条件的内容。审核由“感觉这段像是对的”转成“这条主张是否被这段精确原文支持”。",
            en: "Natural-language summaries compress multiple judgments into paragraphs. Independent Claim entities let users accept, reject, or retain each proposition while preserving the original record, turning review from general plausibility into a specific evidence check.",
          },
          {
            zh: "关系建模同样重要。一段反驳材料如果只被模型融合进流畅总结，读者无法知道原始分歧是否仍存在。Evidence Graph 为 Evidence Link 标记支持、反驳或限定，并保存 Claim 之间的冲突、依赖与重复关系。它不保证模型判断永远正确，却让错误落在可定位的边上：关系错了可以改关系，Quote 不精确可以拒绝入库，主张证据不足可以保持待确认，而不是只能整段重新生成。",
            en: "Typed support, contradiction, and qualification links keep disagreement visible. Claim relations preserve conflicts, dependencies, and duplicates. The model can still be wrong, but errors become local and correctable instead of forcing a complete answer regeneration.",
          },
        ],
      },
      {
        heading: { zh: "C4 把差异变成指标", en: "C4 turns the distinction into metrics" },
        paragraphs: [
          {
            zh: "产品差异如果只存在于架构图里仍然不够。C4 用十个固定技术、竞品和市场问题运行真实评测，检查 Quote 是否为保存正文的精确子串、事实段落是否全部带引用、Evidence Relation 人工抽样是否正确、案例是否覆盖足够来源域名、运行是否完成以及单题成本。最终批次达到六项 MVP 门槛：六十五条 Quote 全部精确匹配，事实段落无引用数量为零，二十条关系抽查正确十九条，十题全部完成。",
            en: "C4 evaluated ten fixed technical, competitive, and market questions across exact quotes, factual-paragraph citations, sampled relation accuracy, source-domain coverage, completion, and bounded cost. The final batch met all six MVP gates: 65 of 65 exact quotes, zero uncited factual paragraphs, 19 of 20 sampled relations correct, and all ten runs completed.",
          },
          {
            zh: "这些数字不是在宣称研究结论本身永远正确。它们证明的是产品约束开始可执行：引用可以精确核对，未引用事实不会混进公开报告，关系判断可以人工抽样，失败能够定位到 Run、Claim、Evidence、Chunk、Report 和 Citation。与普通总结相比，Evidence Graph 的承诺因此不是“模型更聪明”，而是“错误更容易被看到、复核和留下修正记录”。",
            en: "The numbers do not prove every conclusion true. They show that citation, publication, relation sampling, and failure-location constraints are executable. The promise is not a smarter model but errors that are easier to see, verify, and correct with a retained record.",
          },
        ],
      },
      {
        heading: { zh: "定位为证据交付", en: "Position it as evidence delivery" },
        paragraphs: [
          {
            zh: "这也确定了产品取舍。若用户只想快速知道一个问题的大概答案，普通 AI 搜索更轻；Evidence Graph 不应通过增加聊天功能去争夺这类场景。它适合结论需要交给同事、客户或未来自己的任务：技术选型、竞品比较、市场事实核查，以及任何需要说明“为什么这样决定”的研究。工作台的核心交互应继续围绕 Claim 审核、来源原文、关系图和版本化报告，而不是把图谱降级为总结后的装饰。",
            en: "For a quick orientation, ordinary AI search remains lighter. Evidence Graph should serve decisions that must be handed to colleagues, clients, or a future self: technical choices, competitive research, market facts, and other work where the reasoning record matters.",
          },
          {
            zh: "最终决策是继续建设研究审核与证据交付工具。首页展示真实 Source 到 Decision 的链路，案例文章公开失败与修正，报告让访客直接打开原始来源。后续成功指标应围绕核验时间、引用完整性、关系准确率和报告复用，而不是首个回答出现得有多快。只有守住这条边界，Evidence Graph 才不是一个更慢的搜索总结，而是一套能对结论负责的研究基础设施。",
            en: "The decision is to continue as a research review and evidence-delivery tool. Success should be measured by verification time, citation completeness, relation accuracy, and report reuse rather than first-token speed. That boundary keeps Evidence Graph from becoming merely a slower search summary.",
          },
        ],
      },
    ],
    graph: {
      nodes: [
        {
          id: "comparison-source",
          type: "source",
          label: { zh: "C4 固定十题评测", en: "C4 fixed ten-question evaluation" },
          detail: {
            zh: "真实完成批次记录精确 Quote、关系、来源覆盖与完成率。",
            en: "The completed real batch records exact quotes, relations, source coverage, and completion.",
          },
        },
        {
          id: "comparison-evidence",
          type: "evidence",
          label: { zh: "65/65 精确引用，19/20 关系正确", en: "65/65 exact quotes, 19/20 correct relations" },
          detail: {
            zh: "公开报告的无引用事实段落为 0，十题全部完成。",
            en: "Public reports had zero uncited factual paragraphs and all ten runs completed.",
          },
        },
        {
          id: "comparison-claim",
          type: "claim",
          label: { zh: "差异是可审核研究对象", en: "The distinction is a reviewable research object" },
          detail: {
            zh: "Source、Evidence、Claim 和关系独立保存，错误可以局部修正。",
            en: "Sources, Evidence, Claims, and relations persist independently so errors can be corrected locally.",
          },
        },
        {
          id: "comparison-decision",
          type: "decision",
          label: { zh: "聚焦证据交付，不做通用搜索", en: "Focus on evidence delivery, not general search" },
          detail: {
            zh: "用核验、关系准确率和报告审计衡量价值。",
            en: "Measure value through verification, relation accuracy, and report auditability.",
          },
        },
      ],
      edges: [
        { id: "comparison-edge-1", from: "comparison-source", to: "comparison-evidence" },
        { id: "comparison-edge-2", from: "comparison-evidence", to: "comparison-claim" },
        { id: "comparison-edge-3", from: "comparison-claim", to: "comparison-decision" },
      ],
    },
  },
  {
    slug: "long-running-ai-infrastructure",
    reportSlug: "long-running-ai-infrastructure-report",
    reportLanguage: "zh",
    publishedAt: "2026-07-31T02:10:00.000Z",
    researchedAt: "2026-07-31",
    sourceCount: 6,
    title: {
      zh: "Vercel、Railway、Cloudflare：长时 AI 研究工作流怎么选？",
      en: "Vercel, Railway, or Cloudflare for long-running AI research workflows?",
    },
    summary: {
      zh: "对现有容器化 Inngest worker，Railway 是最小迁移的执行层；Vercel 保留 Web 与 API，Cloudflare Workflows 作为未来需要边缘耐久编排时再评估的方案。",
      en: "For the existing containerized Inngest workers, Railway is the lowest-migration execution layer; keep Vercel for web and API, and revisit Cloudflare Workflows only if edge-native durable orchestration becomes necessary.",
    },
    question: {
      zh: "Evidence Graph 的长时、可重试、有状态研究任务应继续放在 Vercel，迁移 Railway，还是改写到 Cloudflare？",
      en: "Should Evidence Graph keep long-running, retryable, stateful research jobs on Vercel, move them to Railway, or rewrite them for Cloudflare?",
    },
    scope: {
      zh: "比较 2026-07-31 的官方运行时与工作流文档，并以当前 Next.js + Inngest + Supabase 架构的迁移成本为约束；不包含真实生产负载、账单压测或供应商 SLA 谈判。",
      en: "The comparison uses official runtime and workflow documentation as of 2026-07-31 and constrains the decision by the current Next.js, Inngest, and Supabase architecture; it excludes production load, billing tests, and negotiated SLAs.",
    },
    decision: {
      zh: "采用分层部署：Vercel 承载作品集、Web 与短 API，Railway 的 Persistent Service 运行现有 Inngest worker；暂不为 Cloudflare Workflows 重写任务。",
      en: "Use a split deployment: Vercel for the portfolio, web app, and short APIs, with a Railway Persistent Service for the existing Inngest worker; do not rewrite jobs for Cloudflare Workflows yet.",
    },
    limitations: [
      {
        zh: "官方限制会随套餐和产品更新变化，实施前仍需锁定区域、价格、休眠策略、网络出口和数据库连接数。",
        en: "Official limits change with plans and product updates; implementation still needs region, pricing, sleep policy, egress, and database-connection checks.",
      },
      {
        zh: "未在三家平台部署相同真实负载，因此本结论优先最小迁移与故障模型，不比较吞吐、尾延迟或最终月成本。",
        en: "The same production workload was not deployed across all three platforms, so the decision prioritizes migration cost and failure model rather than throughput, tail latency, or final monthly cost.",
      },
    ],
    failure: {
      what: {
        zh: "初稿把 Vercel Function 的 300/800 秒上限直接解释为“Vercel 不能跑长任务”，忽略 Vercel Workflows 已能暂停和恢复数月。",
        en: "The first draft treated Vercel Function limits as proof that Vercel cannot run long jobs, overlooking Vercel Workflows and its ability to pause and resume for months.",
      },
      correction: {
        zh: "把单次函数运行时与耐久工作流分开比较，再加入现有 Inngest worker 的迁移成本。Vercel 变成可行但需改造的选项，Railway 因容器常驻和最少改写胜出。",
        en: "Separating function runtime from durable workflow capability, then adding the current Inngest migration cost, made Vercel viable but rewrite-heavy and left Railway as the lowest-change choice.",
      },
    },
    article: [
      {
        heading: { zh: "先比较任务模型", en: "Compare the workload model first" },
        paragraphs: [
          {
            zh: "长时 AI 研究并不等于一个函数持续占用 CPU 几十分钟。Evidence Graph 的流程包含搜索、抓取、切块、向量化、主张提取、证据关联、冲突判断和报告生成，其中大量时间是在等待网络与外部 Provider。可靠系统需要持久化步骤状态、幂等重试、失败恢复和成本记账。选平台时必须区分三件事：单次请求能活多久、是否提供耐久编排原语，以及现有 worker 要改写多少。只比较一个“最长秒数”会得到错误结论。",
            en: "Long AI research is not simply a function burning CPU for many minutes. It spans search, collection, indexing, extraction, linking, conflict checks, and report generation, with substantial I/O waits. Platform choice must separate request duration, durable orchestration primitives, and the rewrite required by the existing worker.",
          },
          {
            zh: "当前系统已经使用 Next.js 处理 Web 和短请求，用 Inngest 把研究拆成可恢复步骤，并把项目、运行和证据状态保存在 Supabase。迁移目标不是寻找理论上功能最多的平台，而是在不破坏这条链路的前提下，让 worker 有稳定的常驻进程、清楚的重启行为和可观察日志。网页层与执行层可以分开部署，因此最终答案不必是三家只能选一家。",
            en: "The current system already uses Next.js for web traffic, Inngest for recoverable steps, and Supabase for durable project and evidence state. The migration goal is a stable process, explicit restart behavior, and observable logs without breaking that chain. Web and execution layers need not share one vendor.",
          },
        ],
      },
      {
        heading: { zh: "Vercel 可行，但有两条路线", en: "Vercel is viable through two different paths" },
        paragraphs: [
          {
            zh: "普通 Vercel Functions 在 Fluid compute 下仍有最大持续时间：Hobby 为三百秒，Pro 与 Enterprise 常规最大八百秒，扩展 Beta 可到一千八百秒。它适合短 API、回调和可在限制内结束的任务，但不能把一个不可分割的长研究过程随意塞进单次调用。超时风险还会与 Provider 响应抖动、重试和冷启动叠加，因此现有 worker 若完全依赖一个函数生命周期，故障边界并不理想。",
            en: "Vercel Functions still have maximum durations under Fluid compute: 300 seconds on Hobby, 800 seconds on Pro and Enterprise, and an extended beta maximum of 1,800 seconds. Short APIs and bounded callbacks fit; an indivisible research run tied to one invocation remains fragile.",
          },
          {
            zh: "但这不等于 Vercel 无法处理长流程。Vercel Workflows 明确支持代码暂停数分钟到数月，并从原位置恢复，提供耐久状态和重试。它是技术上成立的候选，只是意味着把现有 Inngest 步骤和事件语义改写到另一套 SDK，同时迁移观测与本地调试方式。当前产品尚未证明这种重写能带来足够收益，所以 Vercel 最合适的职责仍是保留成熟的 Next.js Web、公开报告与短 API。",
            en: "Vercel Workflows changes the conclusion: it can pause for minutes or months and resume from the same point. It is technically viable, but adopting it would rewrite current Inngest step, event, observability, and local-debug semantics. That benefit is not yet proven, so Vercel remains best for the existing Next.js surface and short APIs.",
          },
        ],
      },
      {
        heading: { zh: "Railway 赢在迁移最小", en: "Railway wins on migration cost" },
        paragraphs: [
          {
            zh: "Railway 把 Service 定义为容器部署目标，并明确提供始终运行的 Persistent Service。对现有 Node Inngest worker，这和当前进程模型最接近：构建镜像、设置启动命令、连接同一个 Supabase，再让 Inngest 调度已有函数。它不自动赋予业务级幂等或步骤状态，但这些能力已经由应用与 Inngest 承担。平台只需稳定托管进程，不必同时替换编排层。",
            en: "Railway defines a Service as a container deployment target and provides always-running Persistent Services. That closely matches the current Node Inngest worker: build an image, set the start command, connect Supabase, and keep the existing function orchestration.",
          },
          {
            zh: "故障行为也更直接。Railway 默认 On Failure 并限制十次重启，付费计划可以设置任意重启策略和次数。真正实施时仍需处理健康检查、优雅退出、重复事件、无状态文件系统和数据库连接，但这些是常驻 worker 已知的问题，而不是框架重写。对需要快速验证功能可用的当前阶段，减少新原语比追求单平台统一更重要，因此 Railway 成为执行层首选。",
            en: "Railway's default On Failure policy allows ten restarts, while paid plans allow other policies and counts. Health checks, graceful shutdown, duplicate events, ephemeral disks, and database connections still need engineering, but they are known worker concerns rather than an orchestration rewrite.",
          },
        ],
      },
      {
        heading: { zh: "Cloudflare 留作后续架构选项", en: "Keep Cloudflare as a future architecture option" },
        paragraphs: [
          {
            zh: "单看普通 Workers 容易产生另一种误判：HTTP 连接保持时墙钟时间没有硬上限，但付费 Worker 主动 CPU 默认三十秒、最多五分钟，内存为一百二十八 MB；响应结束或客户端断开后，waitUntil 通常只延长三十秒。把长任务依赖在不断开的 HTTP 连接上显然不可靠。另一方面，Cloudflare Workflows 的每个步骤可以拥有不受限的墙钟等待时间，只受 CPU 门限约束，实例也能长期运行并持久等待事件。",
            en: "Ordinary Workers have no hard wall-time limit while a client stays connected, but paid CPU time tops out at five minutes, memory is 128 MB, and waitUntil generally adds only 30 seconds after response or disconnect. Cloudflare Workflows is different: steps can wait without a wall-time ceiling while remaining subject to CPU limits, and instances can persist across long waits.",
          },
          {
            zh: "因此 Cloudflare 不是能力不足，而是当前适配成本较高。要充分利用它，需要按 Workflows 的步骤、存储、事件和 CPU 约束重新组织任务，并重新验证 Node 依赖、正文处理和数据库访问。若未来产品需要大量边缘触发、长时间休眠或全球事件恢复，这种改写可能值得；现在最小方案是分层部署：Vercel 保留 Web，Railway 承载现有 worker，Supabase 继续保存事实状态，并通过故障注入验证重复执行与恢复。",
            en: "Cloudflare is not incapable; it is currently a higher-adaptation choice. A useful migration would redesign tasks around Workflow steps, storage, events, CPU limits, Node compatibility, source processing, and database access. Revisit it when edge-triggered or long-sleeping global workflows justify the rewrite. For now, split Vercel web from Railway workers and validate recovery through fault injection.",
          },
        ],
      },
    ],
    graph: {
      nodes: [
        {
          id: "infrastructure-source",
          type: "source",
          label: { zh: "三家官方运行时文档", en: "Official runtime documentation from three vendors" },
          detail: {
            zh: "区分函数持续时间、常驻容器和耐久工作流。",
            en: "The sources separate function duration, persistent containers, and durable workflows.",
          },
        },
        {
          id: "infrastructure-evidence",
          type: "evidence",
          label: { zh: "Railway 提供始终运行的容器服务", en: "Railway provides always-running container services" },
          detail: {
            zh: "现有 Inngest worker 可保持进程模型，不必改写任务编排。",
            en: "The current Inngest worker can retain its process model without an orchestration rewrite.",
          },
        },
        {
          id: "infrastructure-claim",
          type: "claim",
          label: { zh: "当前最优是分层而非单平台", en: "A split platform is currently better than one vendor" },
          detail: {
            zh: "Web 与长时执行的约束不同，应分别选择最小迁移目标。",
            en: "Web delivery and long-running execution have different constraints and migration costs.",
          },
        },
        {
          id: "infrastructure-decision",
          type: "decision",
          label: { zh: "Vercel Web + Railway worker", en: "Vercel web plus Railway worker" },
          detail: {
            zh: "Cloudflare Workflows 保留为未来需要边缘耐久编排时的候选。",
            en: "Keep Cloudflare Workflows as a future candidate for edge-native durable orchestration.",
          },
        },
      ],
      edges: [
        { id: "infrastructure-edge-1", from: "infrastructure-source", to: "infrastructure-evidence" },
        { id: "infrastructure-edge-2", from: "infrastructure-evidence", to: "infrastructure-claim" },
        { id: "infrastructure-edge-3", from: "infrastructure-claim", to: "infrastructure-decision" },
      ],
    },
  },
];

export function getPublicResearchCase(slug: string) {
  return publicResearchCases.find((researchCase) => researchCase.slug === slug);
}
