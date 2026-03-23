"use client";

import { useState, useCallback } from "react";
import {
  ExternalLink,
  Calendar,
  Hash,
  Plus,
  Wand2,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useContentQueue,
  useUpdateContentStatus,
  useCreateContentPost,
  useDeleteContentPost,
} from "@/hooks/use-data";
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

const PLATFORM_OPTIONS = [
  { value: "twitter", label: "Twitter / X" },
  { value: "linkedin", label: "LinkedIn" },
];

export default function ContentPage() {
  const { data: posts, isLoading } = useContentQueue();
  const updateStatus = useUpdateContentStatus();
  const createPost = useCreateContentPost();
  const deletePost = useDeleteContentPost();

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["twitter", "linkedin"]);
  const [scheduled, setScheduled] = useState("");
  const [twitterContent, setTwitterContent] = useState("");
  const [linkedinContent, setLinkedinContent] = useState("");
  const [hashtags, setHashtags] = useState("");

  // AI generation state
  const [aiTopic, setAiTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleStatusChange = (
    postNumber: number,
    newStatus: ContentPostStatus
  ) => {
    updateStatus.mutate(
      { postNumber, status: newStatus },
      {
        onSuccess: () =>
          toast.success(`Post ${postNumber} status updated to "${newStatus}"`),
        onError: (error) =>
          toast.error(`Failed to update status: ${error.message}`),
      }
    );
  };

  const handleDelete = (postNumber: number) => {
    deletePost.mutate(postNumber, {
      onSuccess: () => toast.success(`Post ${postNumber} deleted`),
      onError: (error) =>
        toast.error(`Failed to delete: ${error.message}`),
    });
  };

  const resetForm = () => {
    setTitle("");
    setPlatforms(["twitter", "linkedin"]);
    setScheduled("");
    setTwitterContent("");
    setLinkedinContent("");
    setHashtags("");
    setAiTopic("");
  };

  const handleCreate = useCallback(() => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!twitterContent && !linkedinContent) {
      toast.error("Add content for at least one platform");
      return;
    }

    createPost.mutate(
      {
        title: title.trim(),
        platforms,
        scheduled: scheduled || new Date().toISOString().split("T")[0],
        twitter: twitterContent || undefined,
        linkedin: linkedinContent || undefined,
        hashtags: hashtags || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Post created");
          resetForm();
          setShowCreate(false);
        },
        onError: (error) => toast.error(`Failed to create: ${error.message}`),
      }
    );
  }, [
    title,
    platforms,
    scheduled,
    twitterContent,
    linkedinContent,
    hashtags,
    createPost,
  ]);

  const generateWithAI = useCallback(async () => {
    const topic = aiTopic || title;
    if (!topic) {
      toast.error("Enter a title or topic first");
      return;
    }
    setIsGenerating(true);
    try {
      // Generate Twitter content
      if (platforms.includes("twitter")) {
        const tweetRes = await fetch("/api/twitter/generate-tweet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            tone: "professional",
            isThread: false,
          }),
        });
        if (tweetRes.ok) {
          const tweetData = await tweetRes.json();
          setTwitterContent(tweetData.data?.content || "");
        }
      }

      // Generate LinkedIn content
      if (platforms.includes("linkedin")) {
        const linkedinRes = await fetch("/api/linkedin/generate-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postType: "text",
            topic,
            tone: "thought_leader",
          }),
        });
        if (linkedinRes.ok) {
          const linkedinData = await linkedinRes.json();
          setLinkedinContent(linkedinData.data?.content || "");
        }
      }

      // Generate hashtags
      const hashRes = await fetch("/api/twitter/suggest-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count: 5 }),
      });
      if (hashRes.ok) {
        const hashData = await hashRes.json();
        const tags = (hashData.data?.suggestions || [])
          .map((s: { hashtag: string }) => s.hashtag)
          .join(" ");
        if (tags) setHashtags(tags);
      }

      toast.success("AI content generated");
    } catch {
      toast.error("AI generation failed — check your Groq API key");
    } finally {
      setIsGenerating(false);
    }
  }, [aiTopic, title, platforms]);

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
            Create, manage, and schedule social media content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Button>
          <Button
            variant="outline"
            className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)] hover:bg-[var(--color-forge-bg-elevated)] hover:text-[var(--color-forge-accent)]"
            onClick={() => window.open(n8nSchedulerUrl, "_blank")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Scheduler
          </Button>
        </div>
      </div>

      {/* Create Post Form */}
      {showCreate && (
        <Card className="border-[var(--color-forge-accent)] border-opacity-30 bg-[var(--color-forge-bg-card)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[var(--color-forge-text-primary)]">
                Create New Post
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="h-7 w-7 p-0 text-[var(--color-forge-text-muted)]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title + Schedule */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--color-forge-text-secondary)]">
                  Title *
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Product Launch Announcement"
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--color-forge-text-secondary)]">
                  Schedule Date
                </Label>
                <Input
                  type="date"
                  value={scheduled}
                  onChange={(e) => setScheduled(e.target.value)}
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
                />
              </div>
            </div>

            {/* Platforms */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-secondary)]">
                Platforms
              </Label>
              <div className="flex gap-4">
                {PLATFORM_OPTIONS.map((p) => (
                  <div key={p.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`platform-${p.value}`}
                      checked={platforms.includes(p.value)}
                      onCheckedChange={(checked) =>
                        setPlatforms((prev) =>
                          checked
                            ? [...prev, p.value]
                            : prev.filter((v) => v !== p.value)
                        )
                      }
                    />
                    <Label
                      htmlFor={`platform-${p.value}`}
                      className="cursor-pointer text-sm text-[var(--color-forge-text-primary)]"
                    >
                      {p.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Generation */}
            <div className="rounded-lg border border-dashed border-[var(--color-forge-accent)] bg-[var(--color-forge-accent-muted)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="h-4 w-4 text-[var(--color-forge-accent)]" />
                <span className="text-xs font-medium text-[var(--color-forge-accent)]">
                  AI-Powered Generation
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Topic or leave empty to use title..."
                  className="flex-1 h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                />
                <Button
                  size="sm"
                  onClick={generateWithAI}
                  disabled={isGenerating || (!aiTopic && !title)}
                  className="h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-1 h-3 w-3" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Content Editors */}
            {platforms.includes("twitter") && (
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--color-forge-info)]">
                  Twitter / X Content
                </Label>
                <Textarea
                  value={twitterContent}
                  onChange={(e) => setTwitterContent(e.target.value)}
                  placeholder="Write your tweet..."
                  rows={3}
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                />
                <p className="text-[10px] text-[var(--color-forge-text-muted)] text-right">
                  {twitterContent.length}/280 characters
                </p>
              </div>
            )}

            {platforms.includes("linkedin") && (
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--color-forge-secondary)]">
                  LinkedIn Content
                </Label>
                <Textarea
                  value={linkedinContent}
                  onChange={(e) => setLinkedinContent(e.target.value)}
                  placeholder="Write your LinkedIn post..."
                  rows={5}
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                />
              </div>
            )}

            {/* Hashtags */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-secondary)]">
                Hashtags
              </Label>
              <Input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#CAD #Engineering #Manufacturing"
                className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCreate}
                disabled={createPost.isPending}
                className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
              >
                {createPost.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Post
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Bar */}
      {!isLoading && posts && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-forge-text-muted)]">
          <span>{posts.length} total posts</span>
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
      ) : posts && posts.length === 0 ? (
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <Calendar className="h-10 w-10 mx-auto text-[var(--color-forge-accent)] opacity-40" />
              <p className="text-sm text-[var(--color-forge-text-muted)]">
                No content posts yet. Create your first post to get started.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                variant="outline"
                className="border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            </div>
          </CardContent>
        </Card>
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
                        <Badge
                          className={`${statusStyle.bg} ${statusStyle.text}`}
                        >
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
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={post.status}
                        onValueChange={(val) =>
                          handleStatusChange(
                            post.number,
                            val as ContentPostStatus
                          )
                        }
                      >
                        <SelectTrigger className="w-[120px] shrink-0 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="posted">Posted</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(post.number)}
                        className="h-8 w-8 p-0 text-[var(--color-forge-error)] hover:text-[var(--color-forge-error)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
