"use client";

import cytoscape, {
  type Core,
  type CytoscapeOptions,
  type ElementDefinition,
  type StylesheetJson,
} from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  EvidenceGraphElement,
  EvidenceGraphElementData,
} from "@/features/research/evidence-workspace";

import styles from "./evidence-workspace.module.css";

const graphStyles: StylesheetJson = [
  {
    selector: "node",
    style: {
      width: 150,
      height: 58,
      padding: "8px",
      shape: "round-rectangle",
      "background-color": "#283029",
      "border-color": "#717b72",
      "border-width": 1,
      color: "#f4f1e8",
      label: "data(label)",
      "font-family": "Inter, system-ui, sans-serif",
      "font-size": 9,
      "font-weight": 600,
      "text-halign": "center",
      "text-valign": "center",
      "text-wrap": "ellipsis",
      "text-max-width": "126px",
    },
  },
  {
    selector: 'node[kind = "claim"]',
    style: {
      "background-color": "#313932",
      "border-color": "#d7ded6",
    },
  },
  {
    selector: 'node[kind = "evidence"]',
    style: {
      width: 132,
      height: 50,
      "background-color": "#173f39",
      "border-color": "#51a797",
    },
  },
  {
    selector: 'node[kind = "source"]',
    style: {
      width: 126,
      height: 46,
      "background-color": "#3a3528",
      "border-color": "#c8a25a",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "curve-style": "bezier",
      "line-color": "#657067",
      "target-arrow-color": "#657067",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.7,
      opacity: 0.82,
    },
  },
  {
    selector: 'edge[relation = "supports"]',
    style: { "line-color": "#4f9e90", "target-arrow-color": "#4f9e90" },
  },
  {
    selector: 'edge[relation = "rebuts"]',
    style: { "line-color": "#c45d51", "target-arrow-color": "#c45d51" },
  },
  {
    selector: 'edge[relation = "qualifies"]',
    style: { "line-color": "#c99a3f", "target-arrow-color": "#c99a3f" },
  },
  {
    selector: 'edge[kind = "claim-relation"]',
    style: {
      "line-style": "dashed",
      "line-color": "#a07973",
      "target-arrow-color": "#a07973",
    },
  },
  {
    selector: ".is-selected",
    style: {
      "border-color": "#ffffff",
      "border-width": 3,
      "overlay-color": "#ffffff",
      "overlay-opacity": 0.08,
      "overlay-padding": 7,
      "z-index": 20,
    },
  },
  {
    selector: ".is-keyboard-focus",
    style: {
      "border-color": "#d96a5d",
      "border-width": 3,
    },
  },
];

export function WorkspaceGraph({
  elements,
  selectedNodeId,
  labels,
  onSelect,
}: {
  elements: EvidenceGraphElement[];
  selectedNodeId: string;
  labels: {
    ariaLabel: string;
    navigatorLabel: string;
    keyboardHint: string;
    claim: string;
    evidence: string;
    source: string;
    separator: string;
  };
  onSelect: (data: EvidenceGraphElementData) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  const [isReady, setIsReady] = useState(false);
  const [keyboardNodeId, setKeyboardNodeId] = useState(selectedNodeId);
  const nodes = useMemo(
    () => elements.filter((element) => element.group === "nodes"),
    [elements],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const headless = typeof ResizeObserver === "undefined";
    const options: CytoscapeOptions = {
      elements: elements as ElementDefinition[],
      headless,
      styleEnabled: !headless,
      style: graphStyles,
      layout: {
        name: "breadthfirst",
        directed: true,
        animate: false,
        fit: true,
        padding: 42,
        spacingFactor: 1.3,
      },
      minZoom: 0.32,
      maxZoom: 2.2,
    };

    if (!headless) {
      options.container = container;
    }

    const graph = cytoscape(options);
    graphRef.current = graph;
    graph.on("tap", "node", (event) => {
      const data = event.target.data() as EvidenceGraphElementData;
      setKeyboardNodeId(data.id);
      onSelectRef.current(data);
    });
    graph.ready(() => setIsReady(true));

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [elements]);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    graph.elements().removeClass("is-selected");
    graph.getElementById(selectedNodeId).addClass("is-selected");
    setKeyboardNodeId(selectedNodeId);
  }, [selectedNodeId]);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    graph.elements().removeClass("is-keyboard-focus");
    graph.getElementById(keyboardNodeId).addClass("is-keyboard-focus");
  }, [keyboardNodeId]);

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (nodes.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      nodes.findIndex((node) => node.data.id === keyboardNodeId),
    );

    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + direction + nodes.length) % nodes.length;
      setKeyboardNodeId(nodes[nextIndex].data.id);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const currentNode = nodes.find((node) => node.data.id === keyboardNodeId);

      if (currentNode) {
        onSelect(currentNode.data);
      }
    }
  };

  return (
    <div
      className={styles.graphExperience}
      data-testid="workspace-graph"
      data-graph-ready={String(isReady)}
      data-graph-elements={elements.length}
    >
      <div
        ref={containerRef}
        className={styles.cytoscapeCanvas}
        role="application"
        aria-label={labels.ariaLabel}
        aria-describedby="workspace-graph-keyboard-hint"
        tabIndex={0}
        onKeyDown={handleKeyboard}
      />
      <p id="workspace-graph-keyboard-hint" className={styles.keyboardHint}>
        {labels.keyboardHint}
      </p>
      <div className={styles.nodeNavigator} aria-label={labels.navigatorLabel}>
        {nodes.map((node) => {
          const nodeKind = node.data.kind;
          const nodeLabel =
            nodeKind === "claim"
              ? labels.claim
              : nodeKind === "evidence"
                ? labels.evidence
                : labels.source;

          return (
            <button
              key={node.data.id}
              type="button"
              aria-label={`${nodeLabel}${labels.separator}${node.data.label}`}
              aria-pressed={selectedNodeId === node.data.id}
              data-node-kind={nodeKind}
              onClick={() => onSelect(node.data)}
            >
              <span aria-hidden="true" />
              {node.data.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
