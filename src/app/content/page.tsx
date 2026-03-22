"use client";

import { ExternalLink, Calendar, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useContentQueue, useUpdateContentStatus } from "@/hooks/use-data";
import { toast } from "sonner";
import type { ContentPostStatus } from "@/types";

const statusColors: Record<
  ContentPostStatus,
  { bg: string; text: string; label: string }
> = {
  pending: {
    bg: "bg-[rgba(251,191,36,0.15)]",
    text: "text-[var(--color-forge-warning)]",
    label: "Pending",
  },
  scheduled: {
    bg: "bg-[rgba(96,165,250,0.15)]",
    text: "text-[var(--color-forge-info)]",
    label: "Scheduled",
  },
  posted: {
    bg: "bg-[rgba(52,211,153,0.15)]",
    text: "text-[var(--color-forge-success)]",
    label: "Posted",
  },
};

const platformColors: Record<string, { bg: string; text: string }> = {
  twitter: {
    bg: "bg-[rgba(96,165,250,0.15)]",
    text: "text-[var(--color-forge-info)]",
  },
  linkedin: {
    bg: "bg-[rgba(129,140,248,0.15)]",
    text: "text-[var(--color-forge-secondary)]",
  },
};

export default function ContentPage() {
  const { data: posts, isLoading } = useContentQueue();
  const updateStatus = useUpdateContentStatus();

  const handleStatusChange = (postNumber: number, newStatus: ContentPostStatus) => {
    updateStatus.mutate(
      { postNumber, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Post ${postNumber} status updated to "${newStatus}"`);
        },
        onError: (error) => {
          toast.error(`Failed to update status: ${error.message}`);
        },
      }
    );
  };

  const n8nSchedulerUrl = `${process.env.NEXT_PUBLIC_N8N_BASE_URL || "http://localhost:5678"}/workflow/ZSg0NX2JYnxFOhKi`;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-[var(--color-forge-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Content Hub
          </h1>
          <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
            Manage and schedule social media content
          </p>
        </div>
        <Button
          variant="outline"
          className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)] hover:bg-[var(--color-forge-bg-elevated)] hover:text-[var(--color-forge-accent)]"
          onClick={() => window.open(n8nSchedulerUrl, "_blank")}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Trigger Scheduler
        </Button>
      </div>

      {/* Summary Bar */}
      {!isLoading && posts && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-forge-text-muted)]">
          <span>
            {posts.length} total posts
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-[var(--color-forge-warning)]">
            {posts.filter((p) => p.status === "pending").length} pending
          </span>
          <span className="text-[var(--color-forge-info)]">
            {posts.filter((p) => p.status === "scheduled").length} scheduled
          </span>
          <span className="text-[var(--color-forge-success)]">
            {posts.filter((p) => p.status === "posted").length} posted
          </span>
        </div>
      )}

      {/* Content Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]"
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {posts?.map((post) => {
            const statusStyle = statusColors[post.status];
            return (
              <Card
                key={post.number}
                className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] transition-colors hover:bg-[var(--color-forge-bg-card-hover)]"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-lg text-[var(--color-forge-text-primary)]">
                        Post {post.number}: {post.title}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge className={`${statusStyle.bg} ${statusStyle.text}`}>
                          {statusStyle.label}
                        </Badge>
                        {post.platforms.map((platform) => {
                          const pStyle = platformColors[platform] ?? {
                            bg: "bg-[var(--color-forge-bg-elevated)]",
                            text: "text-[var(--color-forge-text-secondary)]",
                          };
                          return (
                            <Badge
                              key={platform}
                              className={`${pStyle.bg} ${pStyle.text}`}
                            >
                              {platform}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    <Select
                      value={post.status}
                      onValueChange={(val) =>
                        handleStatusChange(post.number, val as ContentPostStatus)
                      }
                    >
                      <SelectTrigger className="w-[130px] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="posted">Posted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Schedule + Hashtags */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-forge-text-muted)]">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{post.scheduled}</span>
                    </div>
                    {post.hashtags && (
                      <div className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        <span className="truncate">{post.hashtags}</span>
                      </div>
                    )}
                  </div>

                  {/* Twitter Content */}
                  {post.twitter && (
                    <div className="rounded-lg border border-[var(--color-forge-border-subtle)] bg-[var(--color-forge-bg-elevated)] p-3">
                      <p className="mb-1 text-xs font-medium text-[var(--color-forge-info)]">
                        Twitter / X
                      </p>
                      <p className="text-sm leading-relaxed text-[var(--color-forge-text-secondary)]">
                        {post.twitter}
                      </p>
                    </div>
                  )}

                  {/* LinkedIn Content */}
                  {post.linkedin && (
                    <div className="rounded-lg border border-[var(--color-forge-border-subtle)] bg-[var(--color-forge-bg-elevated)] p-3">
                      <p className="mb-1 text-xs font-medium text-[var(--color-forge-secondary)]">
                        LinkedIn
                      </p>
                      <p className="text-sm leading-relaxed text-[var(--color-forge-text-secondary)]">
                        {post.linkedin.length > 200
                          ? `${post.linkedin.slice(0, 200)}...`
                          : post.linkedin}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
