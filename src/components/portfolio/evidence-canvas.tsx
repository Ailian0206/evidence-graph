"use client";

import { Check, FileText, Quote, Search } from "lucide-react";
import { useState } from "react";

import type { AppLocale } from "@/i18n/routing";

type EvidenceNode = "claim" | "evidence" | "source";

const canvasCopy = {
  zh: {
    query: "可追溯引用是否让 AI 研究更容易审核？",
    claim: "精确引用让主张可被逐条检查",
    evidence: "研究者可以从结论直接回到保存的原文片段。",
    source: "来源 03 / 产品研究访谈",
    labels: { claim: "主张", evidence: "证据", source: "来源" },
    toolbar: {
      hero: "研究运行 01",
      workspace: "运行 01 / 证据审核",
    },
    detail: {
      claim: "待审核主张 · 2 条支持证据",
      evidence: "精确匹配 · 第 18 段",
      source: "2026-07-12 获取 · 一手访谈",
    },
  },
  en: {
    query: "Do traceable citations make AI research easier to review?",
    claim: "Exact citations make claims individually inspectable",
    evidence: "Researchers can move directly from a conclusion to the saved source excerpt.",
    source: "Source 03 / Product research interview",
    labels: { claim: "Claim", evidence: "Evidence", source: "Source" },
    toolbar: {
      hero: "Research run 01",
      workspace: "Run 01 / Evidence review",
    },
    detail: {
      claim: "Proposed claim · 2 supporting excerpts",
      evidence: "Exact match · Paragraph 18",
      source: "Retrieved 2026-07-12 · Primary interview",
    },
  },
} as const;

export function EvidenceCanvas({
  locale,
  mode,
}: {
  locale: AppLocale;
  mode: "hero" | "workspace";
}) {
  const [activeNode, setActiveNode] = useState<EvidenceNode>("evidence");
  const copy = canvasCopy[locale];
  const activateNode = (node: EvidenceNode) => () => setActiveNode(node);

  return (
    <div className={`evidence-canvas evidence-canvas-${mode}`}>
      <div className="canvas-toolbar">
        <span className="canvas-status">
          <span aria-hidden="true" />
          {copy.toolbar[mode]}
        </span>
        <Search aria-hidden="true" size={16} />
      </div>
      <p className="canvas-query">{copy.query}</p>

      <div className="graph-plane" data-active-node={activeNode}>
        <span className="graph-edge edge-claim-evidence" aria-hidden="true" />
        <span className="graph-edge edge-evidence-source" aria-hidden="true" />
        <button
          className="graph-node graph-node-claim"
          type="button"
          aria-pressed={activeNode === "claim"}
          onClick={activateNode("claim")}
          onFocus={activateNode("claim")}
          onPointerEnter={activateNode("claim")}
        >
          <span>{copy.labels.claim}</span>
          <strong>{copy.claim}</strong>
        </button>
        <button
          className="graph-node graph-node-evidence"
          type="button"
          aria-pressed={activeNode === "evidence"}
          onClick={activateNode("evidence")}
          onFocus={activateNode("evidence")}
          onPointerEnter={activateNode("evidence")}
        >
          <Quote aria-hidden="true" size={16} />
          <span>{copy.labels.evidence}</span>
          <strong>{copy.evidence}</strong>
        </button>
        <button
          className="graph-node graph-node-source"
          type="button"
          aria-pressed={activeNode === "source"}
          onClick={activateNode("source")}
          onFocus={activateNode("source")}
          onPointerEnter={activateNode("source")}
        >
          <FileText aria-hidden="true" size={16} />
          <span>{copy.labels.source}</span>
          <strong>{copy.source}</strong>
        </button>
      </div>

      <div className="canvas-inspector" aria-live="polite">
        <Check aria-hidden="true" size={16} />
        <span>{copy.detail[activeNode]}</span>
      </div>
    </div>
  );
}
