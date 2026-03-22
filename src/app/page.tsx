"use client";

import {
  Radio,
  TrendingUp,
  Globe,
  FileText,
  FolderOpen,
  Workflow,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MetricsLineChart, DirectoryPieChart } from "@/components/charts/metrics-chart";
import {
  useRedditMatches,
  useDailyMetrics,
  useContentQueue,
  useDirectories,
  useWorkflows,
} from "@/hooks/use-data";

export default function OverviewPage() {
  const { data: redditMatches, isLoading: loadingReddit } = useRedditMatches();
  const { data: metrics, isLoading: loadingMetrics } = useDailyMetrics();
  const { data: contentQueue, isLoading: loadingContent } = useContentQueue();
  const { data: directories, isLoading: loadingDirectories } = useDirectories();
  const { data: workflows, isLoading: loadingWorkflows } = useWorkflows();

  // Compute KPI values
  const latestMetric = metrics?.length ? metrics[metrics.length - 1] : null;
  const totalMatches = redditMatches?.length ?? 0;
  const totalKarma = latestMetric?.reddit_total_karma ?? 0;
  const websiteStatus = latestMetric?.website_status ?? "---";
  const websiteUp = websiteStatus === "200";
  const contentCount = contentQueue?.length ?? 0;
  const pendingContent = contentQueue?.filter((p) => p.status === "pending").length ?? 0;
  const directoryCount = directories?.length ?? 0;
  const submittedDirs = directories?.filter((d) => d.status !== "pending").length ?? 0;
  const activeWorkflows = workflows?.filter((w) => w.active).length ?? 0;
  const totalWorkflows = workflows?.length ?? 0;

  // Compute directory status breakdown for pie chart
  const dirStatusCounts = directories?.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  const pieData = [
    { name: "Pending", value: dirStatusCounts["pending"] || 0 },
    { name: "Submitted", value: dirStatusCounts["submitted"] || 0 },
    { name: "Approved", value: dirStatusCounts["approved"] || 0 },
    { name: "Live", value: dirStatusCounts["live"] || 0 },
    { name: "Rejected", value: dirStatusCounts["rejected"] || 0 },
  ];

  const isLoading =
    loadingReddit || loadingMetrics || loadingContent || loadingDirectories || loadingWorkflows;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1
          className="text-3xl font-bold text-[var(--color-forge-text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Overview
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Automation platform status at a glance
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Reddit Matches"
          value={totalMatches}
          subtitle="posts found"
          icon={Radio}
          color="accent"
          loading={isLoading}
        />
        <KpiCard
          title="Total Karma"
          value={totalKarma || "N/A"}
          subtitle={latestMetric?.date ?? ""}
          icon={TrendingUp}
          color="secondary"
          loading={isLoading}
        />
        <KpiCard
          title="Website Status"
          value={websiteUp ? "Online" : websiteStatus}
          subtitle={
            latestMetric?.website_response_ms
              ? `${latestMetric.website_response_ms}ms response`
              : undefined
          }
          icon={Globe}
          color={websiteUp ? "success" : "error"}
          loading={isLoading}
        />
        <KpiCard
          title="Content Queue"
          value={contentCount}
          subtitle={`${pendingContent} pending`}
          icon={FileText}
          color="info"
          loading={isLoading}
        />
        <KpiCard
          title="Directories"
          value={`${submittedDirs}/${directoryCount}`}
          subtitle="submitted"
          icon={FolderOpen}
          color="warning"
          loading={isLoading}
        />
        <KpiCard
          title="Active Workflows"
          value={`${activeWorkflows}/${totalWorkflows}`}
          subtitle="n8n workflows"
          icon={Workflow}
          color="success"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MetricsLineChart data={metrics ?? []} loading={loadingMetrics} />
        <DirectoryPieChart data={pieData} loading={loadingDirectories} />
      </div>

      {/* Activity Feed */}
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-forge-text-primary)]">
            Latest Reddit Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingReddit ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : redditMatches?.length ? (
            <div className="space-y-4">
              {redditMatches.slice(0, 5).map((match) => (
                <a
                  key={match.id}
                  href={match.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-[var(--color-forge-bg-elevated)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-forge-accent-muted)]">
                    <Radio className="h-5 w-5 text-[var(--color-forge-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--color-forge-text-primary)]">
                        {match.title}
                      </p>
                      <ExternalLink className="h-3 w-3 shrink-0 text-[var(--color-forge-text-muted)]" />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-secondary)]"
                      >
                        r/{match.subreddit}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                      >
                        {match.matched_keyword}
                      </Badge>
                      <span className="text-xs text-[var(--color-forge-text-muted)]">
                        {formatDistanceToNow(new Date(match.found_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">
                      {match.score}
                    </p>
                    <p className="text-xs text-[var(--color-forge-text-muted)]">
                      score
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-forge-text-muted)]">
              No reddit matches found yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
