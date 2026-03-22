"use client";

import { useState, useMemo } from "react";
import { FolderOpen, ExternalLink, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { useDirectories, useUpdateDirectoryStatus } from "@/hooks/use-data";
import { toast } from "sonner";
import type { DirectoryStatus } from "@/types";

const statusStyles: Record<
  DirectoryStatus,
  { bg: string; text: string; label: string }
> = {
  pending: {
    bg: "bg-[rgba(107,107,103,0.15)]",
    text: "text-[var(--color-forge-text-muted)]",
    label: "Pending",
  },
  submitted: {
    bg: "bg-[rgba(251,191,36,0.15)]",
    text: "text-[var(--color-forge-warning)]",
    label: "Submitted",
  },
  approved: {
    bg: "bg-[rgba(96,165,250,0.15)]",
    text: "text-[var(--color-forge-info)]",
    label: "Approved",
  },
  rejected: {
    bg: "bg-[rgba(248,113,113,0.15)]",
    text: "text-[var(--color-forge-error)]",
    label: "Rejected",
  },
  live: {
    bg: "bg-[rgba(52,211,153,0.15)]",
    text: "text-[var(--color-forge-success)]",
    label: "Live",
  },
};

export default function DirectoriesPage() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { data: directories, isLoading } = useDirectories();
  const updateStatus = useUpdateDirectoryStatus();

  // Derive categories
  const categories = useMemo(() => {
    if (!directories) return [];
    const set = new Set(directories.map((d) => d.category));
    return Array.from(set).sort();
  }, [directories]);

  // Filter
  const filtered = useMemo(() => {
    if (!directories) return [];
    if (categoryFilter === "all") return directories;
    return directories.filter((d) => d.category === categoryFilter);
  }, [directories, categoryFilter]);

  // Stats
  const totalDirs = directories?.length ?? 0;
  const submitted = directories?.filter((d) => d.status !== "pending").length ?? 0;
  const liveDirs = directories?.filter((d) => d.status === "live").length ?? 0;

  // Category progress
  const categoryProgress = useMemo(() => {
    if (!directories) return [];
    const groups: Record<string, { total: number; submitted: number; live: number }> = {};
    directories.forEach((d) => {
      if (!groups[d.category]) {
        groups[d.category] = { total: 0, submitted: 0, live: 0 };
      }
      groups[d.category].total++;
      if (d.status !== "pending") groups[d.category].submitted++;
      if (d.status === "live") groups[d.category].live++;
    });
    return Object.entries(groups).map(([name, stats]) => ({
      name,
      ...stats,
    }));
  }, [directories]);

  const handleStatusChange = (entryNumber: number, newStatus: DirectoryStatus) => {
    const submittedDate =
      newStatus !== "pending"
        ? new Date().toISOString().split("T")[0]
        : undefined;

    updateStatus.mutate(
      { entryNumber, status: newStatus, submittedDate },
      {
        onSuccess: () => {
          toast.success(`Directory #${entryNumber} updated to "${newStatus}"`);
        },
        onError: (error) => {
          toast.error(`Failed to update: ${error.message}`);
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
          Directory Tracker
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Track directory submissions for SEO backlinks
        </p>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total Directories"
          value={totalDirs}
          subtitle="in tracker"
          icon={FolderOpen}
          color="accent"
          loading={isLoading}
        />
        <KpiCard
          title="Submitted"
          value={`${submitted}/${totalDirs}`}
          subtitle={`${totalDirs > 0 ? Math.round((submitted / totalDirs) * 100) : 0}% complete`}
          icon={CheckCircle2}
          color="warning"
          loading={isLoading}
        />
        <KpiCard
          title="Live"
          value={`${liveDirs}/${totalDirs}`}
          subtitle="confirmed live"
          icon={CheckCircle2}
          color="success"
          loading={isLoading}
        />
      </div>

      {/* Category Progress Bars */}
      {!isLoading && categoryProgress.length > 0 && (
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardHeader>
            <CardTitle className="text-[var(--color-forge-text-primary)]">
              Category Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryProgress.map((cat) => (
              <div key={cat.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-[var(--color-forge-text-secondary)]">
                    {cat.name}
                  </span>
                  <span className="text-xs text-[var(--color-forge-text-muted)]">
                    {cat.submitted}/{cat.total} submitted
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-forge-bg-elevated)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-forge-accent)] transition-all duration-500"
                    style={{
                      width: `${cat.total > 0 ? (cat.submitted / cat.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Category Filter Tabs */}
      <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
        <TabsList className="flex-wrap bg-[var(--color-forge-bg-elevated)]">
          <TabsTrigger value="all" className="text-xs">
            All ({totalDirs})
          </TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {cat.replace(" Directories", "").replace(" & ", "/")}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Directory Table */}
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--color-forge-border-default)]">
                    <TableHead className="w-[50px] text-[var(--color-forge-text-muted)]">
                      #
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Directory
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Category
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Status
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Submitted
                    </TableHead>
                    <TableHead className="text-[var(--color-forge-text-muted)]">
                      Notes
                    </TableHead>
                    <TableHead className="w-[60px] text-[var(--color-forge-text-muted)]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((dir) => {
                    const style = statusStyles[dir.status];
                    return (
                      <TableRow
                        key={dir.number}
                        className="border-[var(--color-forge-border-default)] hover:bg-[var(--color-forge-bg-elevated)]"
                      >
                        <TableCell className="text-sm text-[var(--color-forge-text-muted)]">
                          {dir.number}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">
                            {dir.name}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-[var(--color-forge-text-muted)]">
                            {dir.category
                              .replace(" Directories", "")
                              .replace(" & ", "/")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={dir.status}
                            onValueChange={(val) =>
                              handleStatusChange(
                                dir.number,
                                val as DirectoryStatus
                              )
                            }
                          >
                            <SelectTrigger className="w-[120px]">
                              <Badge className={`${style.bg} ${style.text}`}>
                                {style.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="submitted">
                                Submitted
                              </SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="live">Live</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-[var(--color-forge-text-muted)]">
                          {dir.submitted === "\u2014" ? "\u2014" : dir.submitted}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-xs text-[var(--color-forge-text-muted)]">
                            {dir.notes}
                          </p>
                        </TableCell>
                        <TableCell>
                          <a
                            href={dir.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md p-2 text-[var(--color-forge-text-muted)] transition-colors hover:bg-[var(--color-forge-bg-card-hover)] hover:text-[var(--color-forge-accent)]"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
