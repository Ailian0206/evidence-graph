"use client";

import { CircleCheckBig, FileText, Quote, Search, Waypoints } from "lucide-react";
import { useState } from "react";

import type { PublicResearchCase } from "@/content/public-research-cases";
import type { AppLocale } from "@/i18n/routing";

const canvasLabels = {
  zh: {
    source: "来源",
    evidence: "证据",
    claim: "主张",
    decision: "决策",
    hero: "真实案例 / 证据链",
    workspace: "公开研究 / 决策图",
  },
  en: {
    source: "Source",
    evidence: "Evidence",
    claim: "Claim",
    decision: "Decision",
    hero: "Real case / Evidence chain",
    workspace: "Public research / Decision graph",
  },
} as const;

const nodeIcons = {
  source: FileText,
  evidence: Quote,
  claim: Waypoints,
  decision: CircleCheckBig,
} as const;

type EvidenceCanvasProps = {
  locale: AppLocale;
  mode: "hero" | "workspace";
  graph: PublicResearchCase["graph"];
  query: string;
};

export function EvidenceCanvas({ locale, mode, graph, query }: EvidenceCanvasProps) {
  const initialNode =
    graph.nodes.find((node) => node.type === "evidence")?.id ?? graph.nodes[0]?.id ?? "";
  const [selectedNode, setSelectedNode] = useState(initialNode);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const labels = canvasLabels[locale];
  const activeNodeId = hoveredNode ?? focusedNode ?? selectedNode;
  const activeNode = graph.nodes.find((node) => node.id === activeNodeId) ?? graph.nodes[0];

  return (
    <div className={`evidence-canvas evidence-canvas-${mode}`}>
      <div className="canvas-toolbar">
        <span className="canvas-status">
          <span aria-hidden="true" />
          {labels[mode]}
        </span>
        <Search aria-hidden="true" size={16} />
      </div>
      <p className="canvas-query">{query}</p>

      <div
        className="graph-plane"
        data-active-node={activeNode?.type}
        onPointerLeave={() => setHoveredNode(null)}
      >
        {graph.edges.map((edge, index) => (
          <span
            className={`graph-edge graph-edge-${index + 1}`}
            data-active={edge.from === activeNodeId || edge.to === activeNodeId}
            aria-hidden="true"
            key={edge.id}
          />
        ))}
        {graph.nodes.map((node) => {
          const Icon = nodeIcons[node.type];
          return (
            <button
              className={`graph-node graph-node-${node.type}`}
              type="button"
              aria-pressed={selectedNode === node.id}
              onClick={() => setSelectedNode(node.id)}
              onFocus={() => setFocusedNode(node.id)}
              onBlur={() => setFocusedNode(null)}
              onPointerEnter={() => setHoveredNode(node.id)}
              onPointerLeave={() => setHoveredNode(null)}
              key={node.id}
            >
              <Icon aria-hidden="true" size={16} />
              <span>{labels[node.type]}</span>
              <strong>{node.label[locale]}</strong>
            </button>
          );
        })}
      </div>

      <div className="canvas-inspector" aria-live="polite" role="status">
        <CircleCheckBig aria-hidden="true" size={16} />
        <span>{activeNode?.detail[locale]}</span>
      </div>
    </div>
  );
}
