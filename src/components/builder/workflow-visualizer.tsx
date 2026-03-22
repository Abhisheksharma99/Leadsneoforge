"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import {
  Webhook,
  Clock,
  Code2,
  GitBranch,
  ArrowRightLeft,
  Globe,
  Mail,
  Database,
  Bot,
  Rss,
  Play,
  Settings,
  Zap,
  MousePointer,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, unknown>;
  typeVersion?: number;
}

interface WorkflowConnections {
  [sourceName: string]: {
    main?: Array<Array<{ node: string; type: string; index: number }>>;
  };
}

interface WorkflowData {
  name?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
}

interface WorkflowVisualizerProps {
  workflow: WorkflowData;
  onNodeClick?: (node: WorkflowNode) => void;
  selectedNodeId?: string | null;
}

// ─── Node type to icon/color mapping ──────────────────────────────────────────

const nodeTypeMap: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  "n8n-nodes-base.manualTrigger": { icon: Play, color: "#34d399", label: "Manual Trigger" },
  "n8n-nodes-base.scheduleTrigger": { icon: Clock, color: "#34d399", label: "Schedule" },
  "n8n-nodes-base.webhook": { icon: Webhook, color: "#34d399", label: "Webhook" },
  "n8n-nodes-base.httpRequest": { icon: Globe, color: "#818cf8", label: "HTTP Request" },
  "n8n-nodes-base.code": { icon: Code2, color: "#f472b6", label: "Code" },
  "n8n-nodes-base.if": { icon: GitBranch, color: "#fbbf24", label: "IF" },
  "n8n-nodes-base.set": { icon: Settings, color: "#6b7280", label: "Set" },
  "n8n-nodes-base.merge": { icon: ArrowRightLeft, color: "#a78bfa", label: "Merge" },
  "n8n-nodes-base.emailSend": { icon: Mail, color: "#60a5fa", label: "Email" },
  "n8n-nodes-base.slack": { icon: Zap, color: "#4ade80", label: "Slack" },
  "n8n-nodes-base.discord": { icon: Zap, color: "#7c3aed", label: "Discord" },
  "n8n-nodes-base.telegram": { icon: Zap, color: "#38bdf8", label: "Telegram" },
  "n8n-nodes-base.openAi": { icon: Bot, color: "#10b981", label: "OpenAI" },
  "n8n-nodes-base.postgres": { icon: Database, color: "#3b82f6", label: "Postgres" },
  "n8n-nodes-base.mysql": { icon: Database, color: "#f97316", label: "MySQL" },
  "n8n-nodes-base.googleSheets": { icon: Database, color: "#22c55e", label: "Google Sheets" },
  "n8n-nodes-base.rssFeedRead": { icon: Rss, color: "#f97316", label: "RSS Feed" },
  "n8n-nodes-base.noOp": { icon: MousePointer, color: "#6b7280", label: "No Op" },
  "n8n-nodes-base.wait": { icon: Clock, color: "#fbbf24", label: "Wait" },
  "n8n-nodes-base.splitInBatches": { icon: ArrowRightLeft, color: "#a78bfa", label: "Split Batches" },
  "n8n-nodes-base.redis": { icon: Database, color: "#ef4444", label: "Redis" },
};

const defaultNodeStyle = { icon: Zap, color: "#e8a23e", label: "Node" };

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkflowVisualizer({
  workflow,
  onNodeClick,
  selectedNodeId,
}: WorkflowVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Normalize positions so the graph starts at a consistent offset
  const { normalizedNodes, viewBox } = useMemo(() => {
    if (!workflow.nodes?.length) {
      return { normalizedNodes: [], viewBox: "0 0 400 200" };
    }

    const minX = Math.min(...workflow.nodes.map((n) => n.position[0]));
    const minY = Math.min(...workflow.nodes.map((n) => n.position[1]));
    const PADDING = 60;
    const NODE_W = 180;
    const NODE_H = 60;

    const normalized = workflow.nodes.map((node) => ({
      ...node,
      x: node.position[0] - minX + PADDING,
      y: node.position[1] - minY + PADDING,
    }));

    const maxX = Math.max(...normalized.map((n) => n.x)) + NODE_W + PADDING;
    const maxY = Math.max(...normalized.map((n) => n.y)) + NODE_H + PADDING;

    return {
      normalizedNodes: normalized,
      viewBox: `0 0 ${Math.max(maxX, 400)} ${Math.max(maxY, 200)}`,
    };
  }, [workflow.nodes]);

  // Build connection paths
  const connections = useMemo(() => {
    if (!workflow.connections || !normalizedNodes.length) return [];

    const nodeMap = new Map(normalizedNodes.map((n) => [n.name, n]));
    const NODE_W = 180;
    const NODE_H = 60;
    const paths: Array<{
      id: string;
      d: string;
      from: string;
      to: string;
    }> = [];

    for (const [sourceName, conn] of Object.entries(workflow.connections)) {
      const sourceNode = nodeMap.get(sourceName);
      if (!sourceNode || !conn.main) continue;

      for (const outputGroup of conn.main) {
        if (!outputGroup) continue;
        for (const target of outputGroup) {
          const targetNode = nodeMap.get(target.node);
          if (!targetNode) continue;

          const x1 = sourceNode.x + NODE_W;
          const y1 = sourceNode.y + NODE_H / 2;
          const x2 = targetNode.x;
          const y2 = targetNode.y + NODE_H / 2;

          // Cubic bezier for smooth curves
          const dx = Math.abs(x2 - x1) * 0.5;
          const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

          paths.push({
            id: `${sourceName}-${target.node}`,
            d,
            from: sourceName,
            to: target.node,
          });
        }
      }
    }

    return paths;
  }, [workflow.connections, normalizedNodes]);

  const handleNodeClick = useCallback(
    (node: WorkflowNode) => {
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  if (!workflow.nodes?.length) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
        <p className="text-sm text-[var(--color-forge-text-muted)]">
          No workflow to visualize. Describe an automation to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-[var(--color-forge-border-default)] bg-[#0a0a0c]">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="min-h-[400px] w-full"
        style={{ minWidth: "600px" }}
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
          {/* Arrow marker */}
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M 0 0 L 8 3 L 0 6 Z" fill="rgba(232,162,62,0.5)" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Connection lines */}
        {connections.map((conn) => (
          <g key={conn.id}>
            <path
              d={conn.d}
              fill="none"
              stroke="rgba(232,162,62,0.3)"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
            {/* Animated flow dot */}
            <circle r="3" fill="var(--color-forge-accent)" opacity="0.6">
              <animateMotion dur="3s" repeatCount="indefinite" path={conn.d} />
            </circle>
          </g>
        ))}

        {/* Nodes */}
        {normalizedNodes.map((node) => {
          const nodeStyle = nodeTypeMap[node.type] || defaultNodeStyle;
          const Icon = nodeStyle.icon;
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNode === node.id;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => handleNodeClick(node)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              {/* Node background */}
              <rect
                width="180"
                height="60"
                rx="8"
                fill={isSelected ? "rgba(232,162,62,0.15)" : "rgba(255,255,255,0.05)"}
                stroke={isSelected ? "var(--color-forge-accent)" : isHovered ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}
                strokeWidth={isSelected ? 2 : 1}
              />

              {/* Icon background circle */}
              <circle
                cx="28"
                cy="30"
                r="14"
                fill={`${nodeStyle.color}20`}
              />

              {/* Icon (using foreignObject for React components) */}
              <foreignObject x="16" y="18" width="24" height="24">
                <div className="flex h-full w-full items-center justify-center" style={{ color: nodeStyle.color }}>
                  <Icon className="h-4 w-4" />
                </div>
              </foreignObject>

              {/* Node name */}
              <text
                x="52"
                y="26"
                fill="rgba(255,255,255,0.9)"
                fontSize="12"
                fontWeight="500"
                fontFamily="system-ui"
              >
                {node.name.length > 16 ? `${node.name.slice(0, 16)}...` : node.name}
              </text>

              {/* Node type label */}
              <text
                x="52"
                y="42"
                fill="rgba(255,255,255,0.4)"
                fontSize="10"
                fontFamily="system-ui"
              >
                {nodeStyle.label}
              </text>

              {/* Input connector */}
              <circle cx="0" cy="30" r="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

              {/* Output connector */}
              <circle cx="180" cy="30" r="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
