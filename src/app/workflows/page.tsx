"use client";

import { useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Workflow,
  ExternalLink,
  Play,
  CircleDot,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  useWorkflows,
  useToggleWorkflow,
  useRunWorkflow,
  useExecutions,
} from "@/hooks/use-data";
import { toast } from "sonner";

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_BASE_URL || "http://localhost:5678";

const executionStatusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-[var(--color-forge-success)]" />,
  error: <XCircle className="h-4 w-4 text-[var(--color-forge-error)]" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-[var(--color-forge-info)]" />,
  waiting: <Clock className="h-4 w-4 text-[var(--color-forge-warning)]" />,
  unknown: <CircleDot className="h-4 w-4 text-[var(--color-forge-text-muted)]" />,
};

export default function WorkflowsPage() {
  const { data: workflows, isLoading: loadingWorkflows } = useWorkflows();
  const { data: executions, isLoading: loadingExecutions } = useExecutions();
  const toggleWorkflow = useToggleWorkflow();
  const runWorkflow = useRunWorkflow();

  // Build a map from workflowId to workflowName for executions
  const workflowNameMap = useMemo(() => {
    if (!workflows) return {};
    const map: Record<string, string> = {};
    workflows.forEach((w) => {
      map[w.id] = w.name;
    });
    return map;
  }, [workflows]);

  const handleRun = (id: string, name: string) => {
    runWorkflow.mutate({ id }, {
      onSuccess: () => {
        toast.success(`Workflow "${name}" triggered successfully`);
      },
      onError: () => {
        // n8n community edition doesn't support execution via REST API
        // Open in n8n UI for manual execution
        window.open(`${N8N_BASE}/workflow/${id}`, "_blank");
        toast.info(`Opened "${name}" in n8n — click Execute to run`);
      },
    });
  };

  const handleToggle = (id: string, currentActive: boolean) => {
    const newActive = !currentActive;
    toggleWorkflow.mutate(
      { id, active: newActive },
      {
        onSuccess: () => {
          toast.success(
            `Workflow ${newActive ? "activated" : "deactivated"} successfully`
          );
        },
        onError: (error) => {
          toast.error(`Failed to toggle workflow: ${error.message}`);
        },
      }
    );
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1
          className="text-3xl font-bold text-[var(--color-forge-text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          n8n Workflows
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Monitor and control automation workflows
        </p>
      </div>

      {/* Workflow Cards */}
      {loadingWorkflows ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card
              key={i}
              className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]"
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workflows?.map((workflow) => (
            <Card
              key={workflow.id}
              className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] transition-colors hover:bg-[var(--color-forge-bg-card-hover)]"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-base text-[var(--color-forge-text-primary)]">
                      {workflow.name}
                    </CardTitle>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        className={
                          workflow.active
                            ? "bg-[rgba(52,211,153,0.15)] text-[var(--color-forge-success)]"
                            : "bg-[rgba(107,107,103,0.15)] text-[var(--color-forge-text-muted)]"
                        }
                      >
                        {workflow.active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-xs text-[var(--color-forge-text-muted)]">
                        {workflow.nodes?.length ?? 0} nodes
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={workflow.active}
                    onCheckedChange={() =>
                      handleToggle(workflow.id, workflow.active)
                    }
                    disabled={toggleWorkflow.isPending}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[var(--color-forge-text-muted)]">
                    <span>
                      Updated{" "}
                      {workflow.updatedAt
                        ? formatDistanceToNow(new Date(workflow.updatedAt), {
                            addSuffix: true,
                          })
                        : "N/A"}
                    </span>
                    <span className="font-mono text-[10px]">
                      {workflow.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-[var(--color-forge-accent)] text-[var(--color-forge-accent)] hover:bg-[var(--color-forge-accent-muted)]"
                      onClick={() => handleRun(workflow.id, workflow.name)}
                      disabled={runWorkflow.isPending}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Run Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)] hover:bg-[var(--color-forge-bg-elevated)] hover:text-[var(--color-forge-accent)]"
                      onClick={() =>
                        window.open(
                          `${N8N_BASE}/workflow/${workflow.id}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open in n8n
                    </Button>
                  </div>

                  {/* Tags */}
                  {workflow.tags && workflow.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {workflow.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)] text-[10px]"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {workflows?.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-[var(--color-forge-text-muted)]">
              No workflows found. Make sure n8n is running on {N8N_BASE}
            </div>
          )}
        </div>
      )}

      <Separator className="bg-[var(--color-forge-border-default)]" />

      {/* Recent Executions */}
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-forge-text-primary)]">
            Recent Executions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingExecutions ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : executions?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--color-forge-border-default)]">
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      ID
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Workflow
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Status
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Mode
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Started
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Duration
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((exec) => {
                    const workflowName =
                      exec.workflowName ||
                      workflowNameMap[exec.workflowId] ||
                      exec.workflowId;

                    const duration =
                      exec.startedAt && exec.stoppedAt
                        ? (() => {
                            const ms =
                              new Date(exec.stoppedAt).getTime() -
                              new Date(exec.startedAt).getTime();
                            return ms < 1000
                              ? `${ms}ms`
                              : `${(ms / 1000).toFixed(1)}s`;
                          })()
                        : "\u2014";

                    return (
                      <TableRow
                        key={exec.id}
                        className="border-[var(--color-forge-border-default)] hover:bg-[var(--color-forge-bg-elevated)]"
                      >
                        <TableCell className="font-mono text-xs text-[var(--color-forge-text-muted)]">
                          {exec.id}
                        </TableCell>
                        <TableCell className="text-sm text-[var(--color-forge-text-primary)]">
                          {workflowName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {executionStatusIcons[exec.status] ??
                              executionStatusIcons["unknown"]}
                            <span className="text-sm capitalize text-[var(--color-forge-text-secondary)]">
                              {exec.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                          >
                            {exec.mode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[var(--color-forge-text-muted)]">
                          {exec.startedAt
                            ? formatDistanceToNow(new Date(exec.startedAt), {
                                addSuffix: true,
                              })
                            : "\u2014"}
                        </TableCell>
                        <TableCell className="text-sm text-[var(--color-forge-text-muted)]">
                          {duration}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--color-forge-text-muted)]">
              No executions found. Workflows may not have run yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
