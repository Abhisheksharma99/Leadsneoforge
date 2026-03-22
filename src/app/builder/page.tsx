"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Play,
  Import,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Zap,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowVisualizer } from "@/components/builder/workflow-visualizer";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  workflow?: WorkflowData | null;
  error?: string | null;
}

interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, unknown>;
  typeVersion?: number;
}

interface WorkflowData {
  name?: string;
  nodes: WorkflowNode[];
  connections: Record<string, { main?: Array<Array<{ node: string; type: string; index: number }>> }>;
  settings?: Record<string, unknown>;
}

interface ExecutionResult {
  status: "idle" | "running" | "success" | "error";
  output?: string;
  executionId?: string;
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────

const PROMPT_TEMPLATES = [
  {
    label: "Social Media Monitor",
    prompt: "Create a workflow that monitors Twitter/X for mentions of specific keywords, filters by engagement level, and sends a Slack notification for high-engagement mentions.",
  },
  {
    label: "Content Repurposer",
    prompt: "Build a workflow that takes a blog post URL, extracts the content, uses OpenAI to create 5 Twitter posts, 3 LinkedIn posts, and 1 email newsletter summary from it.",
  },
  {
    label: "Lead Enrichment",
    prompt: "Create a workflow triggered by webhook that receives a company name, looks up their website, extracts contact info, and saves results to Google Sheets.",
  },
  {
    label: "Reddit Monitor",
    prompt: "Build a workflow that runs every 30 minutes, scans Reddit subreddits (cad, engineering, manufacturing) for keywords related to CAD software, and saves matching posts via HTTP request to an API endpoint.",
  },
  {
    label: "Email Campaign",
    prompt: "Create a workflow that reads contacts from Google Sheets, personalizes email content using OpenAI, sends emails with rate limiting (1 per 30 seconds), and logs results.",
  },
  {
    label: "Data Pipeline",
    prompt: "Build a workflow that fetches data from a REST API every hour, transforms the JSON response, filters out records older than 7 days, and inserts new records into PostgreSQL.",
  },
  {
    label: "SEO Rank Tracker",
    prompt: "Create a workflow that checks Google search rankings for a list of keywords daily, compares with previous rankings, and sends an email report of position changes.",
  },
  {
    label: "Competitor Watcher",
    prompt: "Build a workflow that monitors competitor websites for pricing changes by checking specific pages, comparing with cached versions, and alerting via Slack when changes are detected.",
  },
];

// ─── Page Component ─────────────────────────────────────────────────────────

export default function BuilderPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowData | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [execution, setExecution] = useState<ExecutionResult>({ status: "idle" });
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonEdit, setJsonEdit] = useState("");
  const [aiModel, setAiModel] = useState("gpt-4o");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate workflow via AI
  const handleGenerate = useCallback(
    async (prompt?: string) => {
      const text = prompt || inputValue.trim();
      if (!text) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setIsGenerating(true);

      try {
        // Build conversation history for context
        const prevMessages = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content:
              m.role === "assistant" && m.workflow
                ? `I generated a workflow called "${m.workflow.name}" with ${m.workflow.nodes.length} nodes.`
                : m.content,
          }));

        const response = await fetch("/api/workflows/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            messages: prevMessages,
            model: aiModel,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || err.details || "Generation failed");
        }

        const result = await response.json();
        const data = result.data;

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.workflow
            ? `Generated **${data.workflow.name || "Workflow"}** with ${data.workflow.nodes?.length || 0} nodes.${data.usage ? ` (${data.usage.total_tokens} tokens)` : ""}`
            : data.error || "Failed to generate a valid workflow.",
          timestamp: new Date(),
          workflow: data.workflow,
          error: data.error,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (data.workflow) {
          setCurrentWorkflow(data.workflow);
          setJsonEdit(JSON.stringify(data.workflow, null, 2));
          toast.success(
            `Workflow "${data.workflow.name}" generated with ${data.workflow.nodes?.length} nodes`
          );
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${error}`,
          timestamp: new Date(),
          error,
        };
        setMessages((prev) => [...prev, errorMsg]);
        toast.error(error);
      } finally {
        setIsGenerating(false);
      }
    },
    [inputValue, messages, aiModel]
  );

  // Import workflow to n8n
  const handleImport = useCallback(async () => {
    if (!currentWorkflow) return;

    try {
      const response = await fetch("/api/workflows/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: currentWorkflow, activate: false }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Import failed");
      }

      const result = await response.json();
      toast.success(`${result.data.message} (ID: ${result.data.id})`);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Import failed: ${error}`);
    }
  }, [currentWorkflow]);

  // Execute workflow (via n8n webhook if imported, or dry-run)
  const handleExecute = useCallback(async () => {
    if (!currentWorkflow) return;

    setExecution({ status: "running" });

    try {
      // First import, then try to run
      const importRes = await fetch("/api/workflows/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: currentWorkflow, activate: true }),
      });

      if (!importRes.ok) {
        throw new Error("Failed to import workflow for execution");
      }

      const importData = await importRes.json();
      const workflowId = importData.data.id;

      // Try to trigger via run endpoint
      const runRes = await fetch(`/api/n8n/workflows/${workflowId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (runRes.ok) {
        const runData = await runRes.json();
        setExecution({
          status: "success",
          output: JSON.stringify(runData.data, null, 2),
          executionId: workflowId,
        });
        toast.success("Workflow executed successfully");
      } else {
        // Fallback: workflow imported but couldn't execute via API
        setExecution({
          status: "success",
          output: `Workflow imported to n8n as ID: ${workflowId}\nOpen n8n to execute manually.`,
          executionId: workflowId,
        });
        toast.info("Workflow imported — open in n8n to execute");
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      setExecution({ status: "error", output: error });
      toast.error(`Execution failed: ${error}`);
    }
  }, [currentWorkflow]);

  // Apply JSON edits
  const handleApplyJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonEdit);
      if (!parsed.nodes) throw new Error("Missing nodes");
      setCurrentWorkflow(parsed);
      toast.success("Workflow JSON updated");
    } catch (err) {
      const error = err instanceof Error ? err.message : "Invalid JSON";
      toast.error(error);
    }
  }, [jsonEdit]);

  const handleCopyJson = useCallback(() => {
    if (currentWorkflow) {
      navigator.clipboard.writeText(JSON.stringify(currentWorkflow, null, 2));
      toast.success("Workflow JSON copied to clipboard");
    }
  }, [currentWorkflow]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-[var(--color-forge-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Workflow Builder
          </h1>
          <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
            Describe automations in natural language. AI generates n8n workflows you can visualize, edit, and run.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={aiModel} onValueChange={setAiModel}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="flex flex-wrap gap-2">
        {PROMPT_TEMPLATES.map((t) => (
          <button
            key={t.label}
            onClick={() => handleGenerate(t.prompt)}
            disabled={isGenerating}
            className="rounded-full border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-1.5 text-xs text-[var(--color-forge-text-secondary)] transition-colors hover:border-[var(--color-forge-accent)] hover:text-[var(--color-forge-accent)] disabled:opacity-50"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Layout: Chat + Visualizer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Panel */}
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] flex flex-col" style={{ minHeight: "600px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-[var(--color-forge-text-primary)] flex items-center gap-2">
              <Bot className="h-4 w-4 text-[var(--color-forge-accent)]" />
              AI Workflow Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4" style={{ maxHeight: "420px" }}>
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <Zap className="h-10 w-10 mx-auto text-[var(--color-forge-accent)] opacity-40" />
                    <p className="text-sm text-[var(--color-forge-text-muted)]">
                      Describe an automation workflow and AI will generate it.
                    </p>
                    <p className="text-xs text-[var(--color-forge-text-muted)]">
                      Try: &quot;Monitor Reddit for mentions of my product and send Slack alerts&quot;
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-forge-accent-muted)]">
                      <Bot className="h-3.5 w-3.5 text-[var(--color-forge-accent)]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]"
                        : msg.error
                          ? "bg-[rgba(239,68,68,0.1)] text-[var(--color-forge-error)]"
                          : "bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
                    }`}
                  >
                    {msg.content}
                    {msg.workflow && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="bg-[rgba(52,211,153,0.15)] text-[var(--color-forge-success)] text-[10px]">
                          {msg.workflow.nodes?.length} nodes
                        </Badge>
                        <button
                          onClick={() => {
                            setCurrentWorkflow(msg.workflow!);
                            setJsonEdit(JSON.stringify(msg.workflow, null, 2));
                          }}
                          className="text-[10px] underline opacity-70 hover:opacity-100"
                        >
                          Load in visualizer
                        </button>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-forge-bg-elevated)]">
                      <User className="h-3.5 w-3.5 text-[var(--color-forge-text-muted)]" />
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-forge-accent-muted)]">
                    <Bot className="h-3.5 w-3.5 text-[var(--color-forge-accent)]" />
                  </div>
                  <div className="rounded-lg bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-[var(--color-forge-text-muted)]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating workflow...
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-end gap-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Describe your automation workflow..."
                rows={2}
                className="resize-none border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
              <Button
                onClick={() => handleGenerate()}
                disabled={isGenerating || !inputValue.trim()}
                className="h-[60px] bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Visualizer Panel */}
        <div className="space-y-4">
          <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)] flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[var(--color-forge-secondary)]" />
                  Workflow Visualizer
                  {currentWorkflow && (
                    <Badge className="bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)] text-[10px] ml-2">
                      {currentWorkflow.name}
                    </Badge>
                  )}
                </CardTitle>
                {currentWorkflow && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyJson}
                      className="h-7 text-xs border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleImport}
                      className="h-7 text-xs border-[var(--color-forge-secondary)] text-[var(--color-forge-secondary)]"
                    >
                      <Import className="h-3 w-3 mr-1" />
                      Import to n8n
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleExecute}
                      disabled={execution.status === "running"}
                      className="h-7 text-xs bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]"
                    >
                      {execution.status === "running" ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      Run
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {currentWorkflow ? (
                <WorkflowVisualizer
                  workflow={currentWorkflow}
                  onNodeClick={(node) => {
                    setSelectedNode(node as WorkflowNode);
                    setShowNodeDetails(true);
                  }}
                  selectedNodeId={selectedNode?.id}
                />
              ) : (
                <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <p className="text-sm text-[var(--color-forge-text-muted)]">
                    Generate a workflow to see the node graph here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Node Details */}
          {showNodeDetails && selectedNode && (
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">
                    Node: {selectedNode.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNodeDetails(false)}
                    className="h-6 w-6 p-0 text-[var(--color-forge-text-muted)]"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2">
                    <span className="text-[var(--color-forge-text-muted)]">Type:</span>
                    <span className="text-[var(--color-forge-text-primary)] font-mono">
                      {selectedNode.type}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[var(--color-forge-text-muted)]">Position:</span>
                    <span className="text-[var(--color-forge-text-primary)]">
                      [{selectedNode.position[0]}, {selectedNode.position[1]}]
                    </span>
                  </div>
                  {selectedNode.parameters && Object.keys(selectedNode.parameters).length > 0 && (
                    <div>
                      <span className="text-[var(--color-forge-text-muted)]">Parameters:</span>
                      <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-forge-bg-elevated)] p-2 text-[10px] text-[var(--color-forge-text-secondary)]">
                        {JSON.stringify(selectedNode.parameters, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Execution Output + JSON Editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Execution Panel */}
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-[var(--color-forge-text-primary)] flex items-center gap-2">
                <Play className="h-4 w-4 text-[var(--color-forge-success)]" />
                Execution Output
              </CardTitle>
              {execution.status !== "idle" && (
                <Badge
                  className={
                    execution.status === "running"
                      ? "bg-[rgba(96,165,250,0.15)] text-[var(--color-forge-info)]"
                      : execution.status === "success"
                        ? "bg-[rgba(52,211,153,0.15)] text-[var(--color-forge-success)]"
                        : "bg-[rgba(239,68,68,0.15)] text-[var(--color-forge-error)]"
                  }
                >
                  {execution.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {execution.status === "success" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {execution.status === "error" && <AlertCircle className="h-3 w-3 mr-1" />}
                  {execution.status}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {execution.status === "idle" ? (
              <div className="flex h-32 items-center justify-center text-sm text-[var(--color-forge-text-muted)]">
                Generate and run a workflow to see output here
              </div>
            ) : execution.status === "running" ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-[var(--color-forge-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing workflow...
              </div>
            ) : (
              <pre className="max-h-48 overflow-auto rounded bg-[var(--color-forge-bg-elevated)] p-3 text-xs text-[var(--color-forge-text-secondary)]">
                {execution.output || "No output"}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* JSON Editor */}
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-[var(--color-forge-text-primary)] flex items-center gap-2">
                <Settings className="h-4 w-4 text-[var(--color-forge-text-muted)]" />
                Workflow JSON
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowJsonEditor(!showJsonEditor)}
                  className="h-7 text-xs text-[var(--color-forge-text-muted)]"
                >
                  {showJsonEditor ? (
                    <ChevronUp className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  )}
                  {showJsonEditor ? "Collapse" : "Expand"}
                </Button>
                {showJsonEditor && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyJson}
                    className="h-7 text-xs border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]"
                  >
                    Apply Changes
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showJsonEditor ? (
              <Textarea
                value={jsonEdit}
                onChange={(e) => setJsonEdit(e.target.value)}
                rows={12}
                className="resize-y font-mono text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
              />
            ) : (
              <pre className="max-h-48 overflow-auto rounded bg-[var(--color-forge-bg-elevated)] p-3 text-xs text-[var(--color-forge-text-secondary)]">
                {currentWorkflow
                  ? JSON.stringify(currentWorkflow, null, 2).slice(0, 500) + "..."
                  : "No workflow generated yet"}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Existing Workflow Loader */}
      <ExistingWorkflowsPanel
        onLoadWorkflow={(wf) => {
          setCurrentWorkflow(wf);
          setJsonEdit(JSON.stringify(wf, null, 2));
          toast.success(`Loaded "${wf.name}" for visualization`);
        }}
      />
    </div>
  );
}

// ─── Existing Workflows Panel ───────────────────────────────────────────────

function ExistingWorkflowsPanel({
  onLoadWorkflow,
}: {
  onLoadWorkflow: (wf: WorkflowData) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string; active: boolean; nodes?: unknown[] }> | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/n8n/workflows");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setWorkflows(data.data || []);
      setExpanded(true);
    } catch {
      toast.error("Failed to load workflows from n8n");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkflowDetails = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/n8n/workflows/${id}/details`);
        if (!res.ok) throw new Error("Failed to fetch details");
        const data = await res.json();
        onLoadWorkflow(data.data);
      } catch {
        toast.error("Failed to load workflow details");
      }
    },
    [onLoadWorkflow]
  );

  return (
    <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">
            Existing n8n Workflows
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWorkflows}
            disabled={loading}
            className="h-7 text-xs border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Import className="h-3 w-3 mr-1" />
            )}
            Load from n8n
          </Button>
        </div>
      </CardHeader>
      {expanded && workflows && (
        <CardContent>
          {workflows.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => loadWorkflowDetails(wf.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2 text-sm transition-colors hover:border-[var(--color-forge-accent)] hover:bg-[var(--color-forge-accent-muted)]"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      wf.active ? "bg-[var(--color-forge-success)]" : "bg-[var(--color-forge-text-muted)]"
                    }`}
                  />
                  <span className="text-[var(--color-forge-text-primary)]">{wf.name}</span>
                  <span className="text-xs text-[var(--color-forge-text-muted)]">
                    {wf.id}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-forge-text-muted)]">
              No workflows found in n8n
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
