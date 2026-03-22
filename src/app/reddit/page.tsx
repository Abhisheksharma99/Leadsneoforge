"use client";

import { useState, useMemo, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Radio,
  Search,
  ExternalLink,
  MessageSquare,
  ArrowUpDown,
  Loader2,
  Radar,
  Clock,
  Sparkles,
  Send,
  Plus,
  X,
  Eye,
  Wand2,
  Package,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  useRedditMatches,
  useScanReddit,
  useLatestPosts,
  useSuggestKeywords,
  useRedditPost,
  useRedditPostConfig,
  useProducts,
  useGenerateProductPost,
} from "@/hooks/use-data";
import { ReplyGeneratorDialog } from "@/components/reddit/reply-generator";
import { toast } from "sonner";
import type { RedditMatch, LatestRedditPost, KeywordSuggestion, SuggestedSubreddit, Product } from "@/types";

// ─── Shared post info for reply generator ────────────────────────────────────
interface ReplyPostInfo {
  title: string;
  content?: string;
  subreddit: string;
  author: string;
  url: string;
  score?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_KEYWORDS = [
  "CAD alternative",
  "free CAD",
  "open source CAD",
  "FreeCAD",
  "STEP file",
  "parametric modeling",
  "SolidWorks alternative",
  "AutoCAD alternative",
  "legacy drawings",
  "3D modeling software",
];

const CONFIGURED_SUBREDDITS = [
  "cad",
  "SolidWorks",
  "AutoCAD",
  "3Dprinting",
  "engineering",
  "manufacturing",
  "MechanicalEngineering",
  "FreeCAD",
];

// ─── Sort types ─────────────────────────────────────────────────────────────

type MatchSortField = "score" | "num_comments" | "created_utc" | "hours_old";
type SortDirection = "asc" | "desc";

// ─── Page Component ─────────────────────────────────────────────────────────

export default function RedditPage() {
  const [replyPost, setReplyPost] = useState<ReplyPostInfo | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);

  const openReplyGenerator = useCallback((post: ReplyPostInfo) => {
    setReplyPost(post);
    setReplyOpen(true);
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1
          className="text-3xl font-bold text-[var(--color-forge-text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Reddit Monitor
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Keyword-matched posts from engineering subreddits
        </p>
      </div>

      <Tabs defaultValue="matches" className="space-y-6">
        <TabsList className="bg-[var(--color-forge-bg-elevated)] border border-[var(--color-forge-border-default)]">
          <TabsTrigger value="matches" className="gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            Keyword Matches
          </TabsTrigger>
          <TabsTrigger value="scanner" className="gap-1.5">
            <Radar className="h-3.5 w-3.5" />
            Live Scanner
          </TabsTrigger>
          <TabsTrigger value="latest" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Latest Posts
          </TabsTrigger>
          <TabsTrigger value="compose" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Compose Post
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches">
          <KeywordMatchesTab onReply={openReplyGenerator} />
        </TabsContent>

        <TabsContent value="scanner">
          <LiveScannerTab onReply={openReplyGenerator} />
        </TabsContent>

        <TabsContent value="latest">
          <LatestPostsTab onReply={openReplyGenerator} />
        </TabsContent>

        <TabsContent value="compose">
          <ComposePostTab />
        </TabsContent>
      </Tabs>

      {/* Reply Generator Dialog */}
      <ReplyGeneratorDialog
        post={replyPost}
        open={replyOpen}
        onClose={() => setReplyOpen(false)}
      />
    </div>
  );
}

// ─── Tab 1: Keyword Matches ─────────────────────────────────────────────────

function KeywordMatchesTab({ onReply }: { onReply: (post: ReplyPostInfo) => void }) {
  const [subredditFilter, setSubredditFilter] = useState<string>("all");
  const [keywordFilter, setKeywordFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<MatchSortField>("created_utc");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const { data: matches, isLoading } = useRedditMatches();

  const subreddits = useMemo(() => {
    if (!matches) return [];
    const set = new Set(matches.map((m) => m.subreddit));
    return Array.from(set).sort();
  }, [matches]);

  const keywords = useMemo(() => {
    if (!matches) return [];
    const set = new Set(matches.map((m) => m.matched_keyword));
    return Array.from(set).sort();
  }, [matches]);

  const filtered = useMemo(() => {
    if (!matches) return [];
    let result = [...matches];

    if (subredditFilter !== "all") {
      result = result.filter((m) => m.subreddit === subredditFilter);
    }
    if (keywordFilter !== "all") {
      result = result.filter((m) => m.matched_keyword === keywordFilter);
    }

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortDir === "asc") return (aVal as number) - (bVal as number);
      return (bVal as number) - (aVal as number);
    });

    return result;
  }, [matches, subredditFilter, keywordFilter, sortField, sortDir]);

  const toggleSort = (field: MatchSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total Matches"
          value={matches?.length ?? 0}
          subtitle="posts found"
          icon={Radio}
          color="accent"
          loading={isLoading}
        />
        <KpiCard
          title="Unique Subreddits"
          value={subreddits.length}
          subtitle="subreddits"
          icon={Search}
          color="secondary"
          loading={isLoading}
        />
        <KpiCard
          title="Unique Keywords"
          value={keywords.length}
          subtitle="keywords matched"
          icon={MessageSquare}
          color="info"
          loading={isLoading}
        />
      </div>

      {/* Filters */}
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-forge-text-muted)]">
                Subreddit:
              </span>
              <Select
                value={subredditFilter}
                onValueChange={setSubredditFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All subreddits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subreddits</SelectItem>
                  {subreddits.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      r/{sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-forge-text-muted)]">
                Keyword:
              </span>
              <Select value={keywordFilter} onValueChange={setKeywordFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All keywords" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All keywords</SelectItem>
                  {keywords.map((kw) => (
                    <SelectItem key={kw} value={kw}>
                      {kw}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-[var(--color-forge-text-muted)]">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <MatchesTable
        matches={filtered}
        isLoading={isLoading}
        toggleSort={toggleSort}
        sortField={sortField}
        sortDir={sortDir}
        onReply={onReply}
      />
    </div>
  );
}

// ─── Tab 2: Live Scanner ────────────────────────────────────────────────────

function LiveScannerTab({ onReply }: { onReply: (post: ReplyPostInfo) => void }) {
  const [keywordsInput, setKeywordsInput] = useState<string>(
    DEFAULT_KEYWORDS.join(", ")
  );
  const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>(
    CONFIGURED_SUBREDDITS
  );
  const [customSubreddit, setCustomSubreddit] = useState<string>("");
  const [scanResults, setScanResults] = useState<RedditMatch[] | null>(null);
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[] | null>(null);
  const [suggestedSubs, setSuggestedSubs] = useState<SuggestedSubreddit[] | null>(null);
  const [analyzedCount, setAnalyzedCount] = useState<number>(0);

  const scanMutation = useScanReddit();
  const suggestMutation = useSuggestKeywords();

  const toggleSubreddit = useCallback((subreddit: string) => {
    setSelectedSubreddits((prev) =>
      prev.includes(subreddit)
        ? prev.filter((s) => s !== subreddit)
        : [...prev, subreddit]
    );
  }, []);

  const addCustomSubreddit = useCallback(() => {
    const sub = customSubreddit.trim().replace(/^r\//, "");
    if (sub && !selectedSubreddits.includes(sub)) {
      setSelectedSubreddits((prev) => [...prev, sub]);
      setCustomSubreddit("");
    }
  }, [customSubreddit, selectedSubreddits]);

  const handleScan = useCallback(() => {
    const keywords = keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (keywords.length === 0) {
      toast.error("Please enter at least one keyword");
      return;
    }
    if (selectedSubreddits.length === 0) {
      toast.error("Please select at least one subreddit");
      return;
    }

    scanMutation.mutate(
      { keywords, subreddits: selectedSubreddits },
      {
        onSuccess: (data) => {
          setScanResults(data.matches);
          if (data.added > 0) {
            toast.success(`Found ${data.added} new matches (${data.matches.length} total in scan)`);
          } else {
            toast.info(
              `Found ${data.matches.length} matches (all already tracked)`
            );
          }
        },
        onError: (error) => {
          toast.error(`Scan failed: ${error.message}`);
        },
      }
    );
  }, [keywordsInput, selectedSubreddits, scanMutation]);

  const handleSuggestKeywords = useCallback(() => {
    const keywords = keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (keywords.length === 0) {
      toast.error("Enter at least one keyword to find related terms");
      return;
    }

    suggestMutation.mutate(
      { keywords, subreddits: selectedSubreddits },
      {
        onSuccess: (data) => {
          setSuggestions(data.suggestions);
          setSuggestedSubs(data.suggestedSubreddits);
          setAnalyzedCount(data.analyzedPosts);
          if (data.suggestions.length > 0) {
            toast.success(
              `Found ${data.suggestions.length} related keywords from ${data.analyzedPosts} posts`
            );
          } else {
            toast.info("No related keywords found. Try different seed keywords.");
          }
        },
        onError: (error) => {
          toast.error(`Suggestion failed: ${error.message}`);
        },
      }
    );
  }, [keywordsInput, selectedSubreddits, suggestMutation]);

  const addSuggestedKeyword = useCallback(
    (keyword: string) => {
      const current = keywordsInput
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      if (!current.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
        setKeywordsInput((prev) => `${prev}, ${keyword}`);
        toast.success(`Added "${keyword}" to keywords`);
      }
    },
    [keywordsInput]
  );

  return (
    <div className="space-y-6">
      {/* Scanner Form */}
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-forge-text-primary)]">
            Reddit Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Keywords Input */}
          <div className="space-y-2">
            <Label
              htmlFor="keywords-input"
              className="text-sm font-medium text-[var(--color-forge-text-secondary)]"
            >
              Keywords (comma-separated)
            </Label>
            <Input
              id="keywords-input"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="CAD alternative, free CAD, open source CAD..."
              className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
            />
            <p className="text-xs text-[var(--color-forge-text-muted)]">
              Searches post titles and body text (case-insensitive)
            </p>
          </div>

          {/* Subreddits Checkboxes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-[var(--color-forge-text-secondary)]">
              Subreddits
            </Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from(new Set([...CONFIGURED_SUBREDDITS, ...selectedSubreddits])).map((sub) => (
                <div key={sub} className="flex items-center gap-2">
                  <Checkbox
                    id={`sub-${sub}`}
                    checked={selectedSubreddits.includes(sub)}
                    onCheckedChange={() => toggleSubreddit(sub)}
                  />
                  <Label
                    htmlFor={`sub-${sub}`}
                    className="cursor-pointer text-sm text-[var(--color-forge-text-primary)]"
                  >
                    r/{sub}
                  </Label>
                </div>
              ))}
            </div>
            {/* Add custom subreddit */}
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={customSubreddit}
                onChange={(e) => setCustomSubreddit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomSubreddit()}
                placeholder="Add custom subreddit..."
                className="w-[200px] h-8 text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addCustomSubreddit}
                className="h-8 border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-xs text-[var(--color-forge-text-muted)]">
              {selectedSubreddits.length} subreddit
              {selectedSubreddits.length !== 1 ? "s" : ""} selected
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleScan}
              disabled={scanMutation.isPending}
              className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)] font-medium"
            >
              {scanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning {selectedSubreddits.length} subreddits...
                </>
              ) : (
                <>
                  <Radar className="mr-2 h-4 w-4" />
                  Scan Now
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleSuggestKeywords}
              disabled={suggestMutation.isPending}
              className="border-[var(--color-forge-secondary)] text-[var(--color-forge-secondary)] hover:bg-[rgba(129,140,248,0.1)]"
            >
              {suggestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Reddit posts...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Suggest Related Keywords
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keyword Suggestions */}
      {suggestMutation.isPending && (
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-sm text-[var(--color-forge-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing Reddit posts to find related keywords...
            </div>
          </CardContent>
        </Card>
      )}

      {suggestions && !suggestMutation.isPending && (
        <Card className="border-[var(--color-forge-secondary)] border-opacity-30 bg-[var(--color-forge-bg-card)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[var(--color-forge-text-primary)] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--color-forge-secondary)]" />
                Suggested Keywords
              </CardTitle>
              <span className="text-xs text-[var(--color-forge-text-muted)]">
                Analyzed {analyzedCount} posts
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.length > 0 ? (
              <>
                <p className="text-xs text-[var(--color-forge-text-muted)]">
                  Click a keyword to add it to your search. Higher relevance = more frequently found.
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.keyword}
                      onClick={() => addSuggestedKeyword(s.keyword)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-forge-text-primary)] transition-all hover:border-[var(--color-forge-secondary)] hover:bg-[rgba(129,140,248,0.1)]"
                    >
                      <Plus className="h-3 w-3 text-[var(--color-forge-text-muted)] group-hover:text-[var(--color-forge-secondary)]" />
                      {s.keyword}
                      <span className="ml-1 text-[10px] text-[var(--color-forge-text-muted)]">
                        {s.relevance}%
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--color-forge-text-muted)]">
                No related keywords found. Try different seed keywords or broader subreddits.
              </p>
            )}

            {/* Suggested subreddits */}
            {suggestedSubs && suggestedSubs.length > 0 && (
              <>
                <Separator className="bg-[var(--color-forge-border-default)]" />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--color-forge-text-secondary)]">
                    Related subreddits you might want to monitor:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedSubs.map((sub) => (
                      <button
                        key={sub.name}
                        onClick={() => {
                          if (!selectedSubreddits.includes(sub.name)) {
                            setSelectedSubreddits((prev) => [...prev, sub.name]);
                            toast.success(`Added r/${sub.name} to subreddits`);
                          }
                        }}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-forge-text-primary)] transition-all hover:border-[var(--color-forge-accent)] hover:bg-[var(--color-forge-accent-muted)]"
                      >
                        <Plus className="h-3 w-3 text-[var(--color-forge-text-muted)] group-hover:text-[var(--color-forge-accent)]" />
                        r/{sub.name}
                        <span className="ml-1 text-[10px] text-[var(--color-forge-text-muted)]">
                          {sub.postCount} posts
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scan Results */}
      {scanMutation.isPending && (
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {scanResults && !scanMutation.isPending && (
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[var(--color-forge-text-primary)]">
                Scan Results
              </CardTitle>
              <Badge
                className="bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)]"
              >
                {scanResults.length} match{scanResults.length !== 1 ? "es" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {scanResults.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--color-forge-border-default)]">
                      <TableHead className="text-[var(--color-forge-text-muted)]">
                        Title
                      </TableHead>
                      <TableHead className="text-[var(--color-forge-text-muted)]">
                        Subreddit
                      </TableHead>
                      <TableHead className="text-[var(--color-forge-text-muted)]">
                        Keyword
                      </TableHead>
                      <TableHead className="text-[var(--color-forge-text-muted)]">
                        Score
                      </TableHead>
                      <TableHead className="text-[var(--color-forge-text-muted)]">
                        Age
                      </TableHead>
                      <TableHead className="text-[var(--color-forge-text-muted)] w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResults.map((match) => (
                      <TableRow
                        key={match.id}
                        className="border-[var(--color-forge-border-default)] hover:bg-[var(--color-forge-bg-elevated)]"
                      >
                        <TableCell className="max-w-[300px]">
                          <p className="truncate text-sm font-medium text-[var(--color-forge-text-primary)]">
                            {match.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--color-forge-text-muted)]">
                            by u/{match.author}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-secondary)]"
                          >
                            r/{match.subreddit}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                          >
                            {match.matched_keyword}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-[var(--color-forge-text-primary)]">
                          {match.score}
                        </TableCell>
                        <TableCell className="text-sm text-[var(--color-forge-text-muted)]">
                          {match.hours_old}h
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                onReply({
                                  title: match.title,
                                  content: match.selftext_preview,
                                  subreddit: match.subreddit,
                                  author: match.author,
                                  url: match.url,
                                  score: match.score,
                                })
                              }
                              className="inline-flex items-center justify-center rounded-md p-2 text-[var(--color-forge-text-muted)] transition-colors hover:bg-[var(--color-forge-accent-muted)] hover:text-[var(--color-forge-accent)]"
                              title="Generate reply"
                            >
                              <Wand2 className="h-4 w-4" />
                            </button>
                            <a
                              href={match.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-md p-2 text-[var(--color-forge-text-muted)] transition-colors hover:bg-[var(--color-forge-bg-elevated)] hover:text-[var(--color-forge-accent)]"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--color-forge-text-muted)]">
                No matches found for the given keywords and subreddits.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 3: Latest Posts ────────────────────────────────────────────────────

function LatestPostsTab({ onReply }: { onReply: (post: ReplyPostInfo) => void }) {
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>("cad");

  const { data: posts, isLoading } = useLatestPosts(selectedSubreddit);

  return (
    <div className="space-y-6">
      {/* Subreddit Selector */}
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-forge-text-muted)]">
              Subreddit:
            </span>
            <Select
              value={selectedSubreddit}
              onValueChange={setSelectedSubreddit}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select subreddit" />
              </SelectTrigger>
              <SelectContent>
                {CONFIGURED_SUBREDDITS.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    r/{sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-forge-accent)]" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[var(--color-forge-text-primary)]">
              Latest Posts in r/{selectedSubreddit}
            </CardTitle>
            {posts && (
              <Badge
                variant="secondary"
                className="bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-secondary)]"
              >
                {posts.length} posts
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="overflow-x-auto">
              <LatestPostsTable posts={posts} onReply={onReply} />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--color-forge-text-muted)]">
              No posts found for r/{selectedSubreddit}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 4: Compose Post ───────────────────────────────────────────────────

function ComposePostTab() {
  const [subreddit, setSubreddit] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [postType, setPostType] = useState<"text" | "link">("text");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const { data: postConfig } = useRedditPostConfig();
  const { data: products } = useProducts();
  const postMutation = useRedditPost();
  const generatePostMutation = useGenerateProductPost();

  const handleGeneratePost = useCallback(() => {
    if (!selectedProductId || selectedProductId === "__none__") {
      toast.error("Select a product first");
      return;
    }
    const sub = subreddit.trim().replace(/^r\//, "") || "cad";
    generatePostMutation.mutate(
      { productId: selectedProductId, subreddit: sub },
      {
        onSuccess: (data) => {
          setTitle(data.title);
          setText(data.body);
          setPostType("text");
          toast.success(
            data.method === "ai"
              ? "Post generated with AI"
              : "Post generated from template"
          );
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }, [selectedProductId, subreddit, generatePostMutation]);

  const handleSubmit = useCallback(() => {
    if (!subreddit.trim()) {
      toast.error("Please enter a subreddit");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a post title");
      return;
    }
    if (postType === "link" && !linkUrl.trim()) {
      toast.error("Please enter a URL for link posts");
      return;
    }

    const cleanSub = subreddit.trim().replace(/^r\//, "");

    postMutation.mutate(
      {
        subreddit: cleanSub,
        title: title.trim(),
        text: postType === "text" ? text.trim() : undefined,
        url: postType === "link" ? linkUrl.trim() : undefined,
      },
      {
        onSuccess: (data) => {
          if (data.posted) {
            toast.success(data.message);
            if (data.postUrl) {
              window.open(data.postUrl, "_blank");
            }
            // Reset form
            setTitle("");
            setText("");
            setLinkUrl("");
          } else if (data.submitUrl) {
            // Fallback: open Reddit's submit page
            window.open(data.submitUrl, "_blank");
            toast.info(data.message);
          }
        },
        onError: (error) => {
          toast.error(`Post failed: ${error.message}`);
        },
      }
    );
  }, [subreddit, title, text, linkUrl, postType, postMutation]);

  return (
    <div className="space-y-6">
      {/* Config Status */}
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                postConfig?.configured
                  ? "bg-[var(--color-forge-success)]"
                  : "bg-[var(--color-forge-warning)]"
              }`}
            />
            <span className="text-sm text-[var(--color-forge-text-secondary)]">
              {postConfig?.configured
                ? `Reddit API connected as u/${postConfig.username}`
                : "Reddit API not configured — posts will open Reddit's submit page"}
            </span>
            {!postConfig?.configured && (
              <span className="text-xs text-[var(--color-forge-text-muted)]">
                Add REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD to .env.local
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Selector + Generate Post */}
      {products && products.length > 0 && (
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardContent className="pt-6">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-[var(--color-forge-text-muted)] flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Product
                </Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {products.map((p: Product) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.isDefault ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGeneratePost}
                disabled={generatePostMutation.isPending || !selectedProductId || selectedProductId === "__none__"}
                className="bg-[var(--color-forge-secondary)] text-white hover:bg-[var(--color-forge-secondary)]/90"
              >
                {generatePostMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Post
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Compose Form */}
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardHeader>
            <CardTitle className="text-[var(--color-forge-text-primary)]">
              Compose Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Subreddit */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[var(--color-forge-text-secondary)]">
                Subreddit
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-forge-text-muted)]">r/</span>
                <Input
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value)}
                  placeholder="cad"
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                />
              </div>
              {/* Quick select */}
              <div className="flex flex-wrap gap-1.5">
                {CONFIGURED_SUBREDDITS.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSubreddit(sub)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      subreddit === sub
                        ? "border-[var(--color-forge-accent)] bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)]"
                        : "border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)] hover:border-[var(--color-forge-accent)] hover:text-[var(--color-forge-text-primary)]"
                    }`}
                  >
                    r/{sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Post Type Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[var(--color-forge-text-secondary)]">
                Post Type
              </Label>
              <div className="flex gap-2">
                <Button
                  variant={postType === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPostType("text")}
                  className={
                    postType === "text"
                      ? "bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]"
                      : "border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
                  }
                >
                  Text Post
                </Button>
                <Button
                  variant={postType === "link" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPostType("link")}
                  className={
                    postType === "link"
                      ? "bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]"
                      : "border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
                  }
                >
                  Link Post
                </Button>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[var(--color-forge-text-secondary)]">
                Title
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title..."
                maxLength={300}
                className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
              <p className="text-xs text-[var(--color-forge-text-muted)]">
                {title.length}/300 characters
              </p>
            </div>

            {/* Text Body or Link URL */}
            {postType === "text" ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--color-forge-text-secondary)]">
                  Body (optional, supports Markdown)
                </Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write your post content here..."
                  rows={8}
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)] resize-y"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--color-forge-text-secondary)]">
                  URL
                </Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                />
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={postMutation.isPending}
                className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)] font-medium"
              >
                {postMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {postConfig?.configured ? "Post to Reddit" : "Open in Reddit"}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? "Hide" : "Show"} Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        {showPreview && (
          <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
            <CardHeader>
              <CardTitle className="text-[var(--color-forge-text-primary)] text-sm">
                Post Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-4">
                {/* Preview header */}
                <div className="flex items-center gap-2 text-xs text-[var(--color-forge-text-muted)]">
                  <span className="font-medium text-[var(--color-forge-text-secondary)]">
                    r/{subreddit || "subreddit"}
                  </span>
                  <span>&bull;</span>
                  <span>Posted by u/{postConfig?.username || "you"}</span>
                  <span>&bull;</span>
                  <span>just now</span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-[var(--color-forge-text-primary)]">
                  {title || "Post title"}
                </h3>

                {/* Body */}
                {postType === "text" && text && (
                  <div className="text-sm text-[var(--color-forge-text-secondary)] whitespace-pre-wrap">
                    {text}
                  </div>
                )}

                {/* Link */}
                {postType === "link" && linkUrl && (
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[var(--color-forge-accent)] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {linkUrl}
                  </a>
                )}

                {/* Mock engagement */}
                <div className="flex items-center gap-4 pt-2 text-xs text-[var(--color-forge-text-muted)]">
                  <span>0 points</span>
                  <span>0 comments</span>
                  <span>share</span>
                  <span>save</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function MatchesTable({
  matches,
  isLoading,
  toggleSort,
  sortField,
  sortDir,
  onReply,
}: {
  matches: RedditMatch[];
  isLoading: boolean;
  toggleSort: (field: MatchSortField) => void;
  sortField: MatchSortField;
  sortDir: SortDirection;
  onReply: (post: ReplyPostInfo) => void;
}) {
  return (
    <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
      <CardHeader>
        <CardTitle className="text-[var(--color-forge-text-primary)]">
          Matched Posts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-forge-border-default)]">
                  <TableHead className="text-[var(--color-forge-text-muted)]">
                    Title
                  </TableHead>
                  <TableHead className="text-[var(--color-forge-text-muted)]">
                    Subreddit
                  </TableHead>
                  <TableHead className="text-[var(--color-forge-text-muted)]">
                    Keyword
                  </TableHead>
                  <TableHead className="text-[var(--color-forge-text-muted)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort("score")}
                      className="h-auto p-0 text-[var(--color-forge-text-muted)] hover:text-[var(--color-forge-text-primary)]"
                    >
                      Score
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-[var(--color-forge-text-muted)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort("num_comments")}
                      className="h-auto p-0 text-[var(--color-forge-text-muted)] hover:text-[var(--color-forge-text-primary)]"
                    >
                      Comments
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-[var(--color-forge-text-muted)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort("hours_old")}
                      className="h-auto p-0 text-[var(--color-forge-text-muted)] hover:text-[var(--color-forge-text-primary)]"
                    >
                      Age
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-[var(--color-forge-text-muted)]">
                    Found
                  </TableHead>
                  <TableHead className="text-[var(--color-forge-text-muted)] w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => (
                  <TableRow
                    key={match.id}
                    className="border-[var(--color-forge-border-default)] hover:bg-[var(--color-forge-bg-elevated)]"
                  >
                    <TableCell className="max-w-[300px]">
                      <p className="truncate text-sm font-medium text-[var(--color-forge-text-primary)]">
                        {match.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-forge-text-muted)]">
                        by u/{match.author}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-secondary)]"
                      >
                        r/{match.subreddit}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                      >
                        {match.matched_keyword}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--color-forge-text-primary)]">
                      {match.score}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--color-forge-text-primary)]">
                      {match.num_comments}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--color-forge-text-muted)]">
                      {match.hours_old.toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-xs text-[var(--color-forge-text-muted)]">
                      {formatDistanceToNow(new Date(match.found_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            onReply({
                              title: match.title,
                              content: match.selftext_preview,
                              subreddit: match.subreddit,
                              author: match.author,
                              url: match.url,
                              score: match.score,
                            })
                          }
                          className="inline-flex items-center justify-center rounded-md p-2 text-[var(--color-forge-text-muted)] transition-colors hover:bg-[var(--color-forge-accent-muted)] hover:text-[var(--color-forge-accent)]"
                          title="Generate reply"
                        >
                          <Wand2 className="h-4 w-4" />
                        </button>
                        <a
                          href={match.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md p-2 text-[var(--color-forge-text-muted)] transition-colors hover:bg-[var(--color-forge-bg-elevated)] hover:text-[var(--color-forge-accent)]"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {matches.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-[var(--color-forge-text-muted)]"
                    >
                      No matches found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LatestPostsTable({ posts, onReply }: { posts: LatestRedditPost[]; onReply: (post: ReplyPostInfo) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[var(--color-forge-border-default)]">
          <TableHead className="text-[var(--color-forge-text-muted)]">
            Title
          </TableHead>
          <TableHead className="text-[var(--color-forge-text-muted)]">
            Author
          </TableHead>
          <TableHead className="text-[var(--color-forge-text-muted)]">
            Score
          </TableHead>
          <TableHead className="text-[var(--color-forge-text-muted)]">
            Comments
          </TableHead>
          <TableHead className="text-[var(--color-forge-text-muted)]">
            Age
          </TableHead>
          <TableHead className="text-[var(--color-forge-text-muted)] w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => (
          <TableRow
            key={post.id}
            className="border-[var(--color-forge-border-default)] hover:bg-[var(--color-forge-bg-elevated)]"
          >
            <TableCell className="max-w-[400px]">
              <p className="truncate text-sm font-medium text-[var(--color-forge-text-primary)]">
                {post.title}
              </p>
              {post.selftext_preview && (
                <p className="mt-0.5 truncate text-xs text-[var(--color-forge-text-muted)]">
                  {post.selftext_preview.substring(0, 120)}
                </p>
              )}
            </TableCell>
            <TableCell className="text-sm text-[var(--color-forge-text-secondary)]">
              u/{post.author}
            </TableCell>
            <TableCell className="text-sm text-[var(--color-forge-text-primary)]">
              {post.score}
            </TableCell>
            <TableCell className="text-sm text-[var(--color-forge-text-primary)]">
              {post.num_comments}
            </TableCell>
            <TableCell className="text-sm text-[var(--color-forge-text-muted)]">
              {post.hours_old < 1
                ? `${Math.round(post.hours_old * 60)}m`
                : `${post.hours_old.toFixed(1)}h`}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    onReply({
                      title: post.title,
                      content: post.selftext_preview,
                      subreddit: post.subreddit,
                      author: post.author,
                      url: post.url,
                      score: post.score,
                    })
                  }
                  className="inline-flex items-center justify-center rounded-md p-2 text-[var(--color-forge-text-muted)] transition-colors hover:bg-[var(--color-forge-accent-muted)] hover:text-[var(--color-forge-accent)]"
                  title="Generate reply"
                >
                  <Wand2 className="h-4 w-4" />
                </button>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md p-2 text-[var(--color-forge-text-muted)] transition-colors hover:bg-[var(--color-forge-bg-elevated)] hover:text-[var(--color-forge-accent)]"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
