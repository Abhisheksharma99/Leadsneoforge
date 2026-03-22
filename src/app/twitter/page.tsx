"use client";

import { useState, useCallback } from "react";
import {
  Twitter,
  Wand2,
  Hash,
  BookOpen,
  Copy,
  ExternalLink,
  Search,
  TrendingUp,
  MessageCircle,
  Users,
  Heart,
  Repeat2,
  Loader2,
  RefreshCw,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TweetComposer } from "@/components/twitter/tweet-composer";
import type { HashtagSuggestion } from "@/types";

// ─── Static Data ────────────────────────────────────────────────────────────

const GROWTH_TIPS = [
  {
    category: "Content Strategy",
    tips: [
      "Post 3-5 tweets per day for maximum growth (1 value thread, 2-3 quick takes, 1 engagement tweet)",
      "Pin your best-performing tweet or thread to your profile",
      "Use Twitter Analytics to find your audience's active hours",
      "Threads outperform single tweets by 3-5x on average",
      "End threads with a strong CTA: follow, retweet, or reply request",
    ],
  },
  {
    category: "Reply Strategy",
    tips: [
      "Reply to 10-15 accounts larger than yours daily with genuinely insightful comments",
      "Be one of the first 5 replies on big accounts' tweets for maximum visibility",
      "Never reply with just 'Great post!' — add context, counter-point, or personal experience",
      "Turn great replies into standalone tweets to maximize content",
      "Use the 'quote tweet + your take' format for thought leadership",
    ],
  },
  {
    category: "Community Building",
    tips: [
      "Join Twitter Spaces in your niche — participate, don't just listen",
      "Create a Twitter List of 50-100 accounts you want to engage with daily",
      "Host a weekly Twitter Space or recurring thread series",
      "Support other creators publicly — genuine engagement builds reciprocity",
      "Share others' content with your unique perspective added",
    ],
  },
  {
    category: "Growth Hacks",
    tips: [
      "Cross-promote from LinkedIn/Reddit to Twitter with native formats",
      "Use your newsletter/blog to funnel readers to Twitter",
      "Collaborate on threads with complementary accounts",
      "Run polls to drive engagement (algorithm loves poll interactions)",
      "Build in public — share metrics, learnings, and behind-the-scenes",
    ],
  },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TwitterPage() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerThread, setComposerThread] = useState(false);

  // Quick Tweet state
  const [quickTweet, setQuickTweet] = useState("");
  const [quickTone, setQuickTone] = useState("professional");

  // Thread Builder state
  const [threadTopic, setThreadTopic] = useState("");
  const [threadLength, setThreadLength] = useState(5);
  const [threadParts, setThreadParts] = useState<string[]>([]);
  const [isGeneratingThread, setIsGeneratingThread] = useState(false);

  // Hashtag Research state
  const [hashtagTopic, setHashtagTopic] = useState("");
  const [hashtagPlatform, setHashtagPlatform] = useState("twitter");
  const [hashtagResults, setHashtagResults] = useState<HashtagSuggestion[]>([]);
  const [isSearchingHashtags, setIsSearchingHashtags] = useState(false);

  const generateQuickTweet = useCallback(async () => {
    if (!quickTweet) {
      toast.error("Enter a topic");
      return;
    }
    setComposerThread(false);
    setComposerOpen(true);
  }, [quickTweet]);

  const generateThread = useCallback(async () => {
    if (!threadTopic) {
      toast.error("Enter a thread topic");
      return;
    }
    setIsGeneratingThread(true);
    try {
      const response = await fetch("/api/twitter/generate-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: threadTopic, isThread: true, threadLength, tone: "educational" }),
      });
      if (!response.ok) throw new Error("Generation failed");
      const result = await response.json();
      setThreadParts(result.data.threadParts || []);
      toast.success(`Thread generated (${result.data.threadParts?.length || 0} tweets)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate thread");
    } finally {
      setIsGeneratingThread(false);
    }
  }, [threadTopic, threadLength]);

  const searchHashtags = useCallback(async () => {
    if (!hashtagTopic) {
      toast.error("Enter a topic");
      return;
    }
    setIsSearchingHashtags(true);
    try {
      const response = await fetch("/api/twitter/suggest-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: hashtagTopic, platform: hashtagPlatform, count: 12 }),
      });
      if (!response.ok) throw new Error("Search failed");
      const result = await response.json();
      setHashtagResults(result.data.suggestions || []);
      toast.success(`Found ${result.data.suggestions?.length || 0} hashtags`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to search hashtags");
    } finally {
      setIsSearchingHashtags(false);
    }
  }, [hashtagTopic, hashtagPlatform]);

  const copyThread = useCallback(() => {
    navigator.clipboard.writeText(threadParts.join("\n\n---\n\n"));
    toast.success("Thread copied to clipboard");
  }, [threadParts]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-forge-text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
          Twitter/X Hub
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Compose tweets, build threads, research hashtags, and grow your presence
        </p>
      </div>

      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList className="bg-[var(--color-forge-bg-elevated)] border border-[var(--color-forge-border-default)]">
          <TabsTrigger value="compose" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Tweet Composer
          </TabsTrigger>
          <TabsTrigger value="thread" className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            Thread Builder
          </TabsTrigger>
          <TabsTrigger value="hashtags" className="gap-1.5">
            <Hash className="h-3.5 w-3.5" />
            Hashtag Research
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Engagement Guide
          </TabsTrigger>
        </TabsList>

        {/* Tweet Composer Tab */}
        <TabsContent value="compose">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Quick compose a tweet with a live character counter. Click Generate to open the full AI-powered composer.
            </p>
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardContent className="p-4 space-y-3">
                <Textarea
                  value={quickTweet}
                  onChange={(e) => setQuickTweet(e.target.value)}
                  placeholder="What's happening?"
                  rows={3}
                  className="resize-none text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: quickTweet.length > 280 ? "var(--color-forge-error)" : quickTweet.length > 250 ? "var(--color-forge-warning)" : "var(--color-forge-text-muted)" }}>
                    {quickTweet.length}/280
                  </span>
                  <div className="flex gap-2">
                    {quickTweet && (
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(quickTweet); toast.success("Copied"); }} className="h-8 text-xs border-[var(--color-forge-border-default)]">
                        <Copy className="h-3 w-3 mr-1" />Copy
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => { setComposerThread(false); setComposerOpen(true); }}
                      className="h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
                    >
                      <Wand2 className="h-3 w-3 mr-1" />AI Generate
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open("https://twitter.com/compose/tweet", "_blank")} className="h-8 text-xs border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]">
                      <ExternalLink className="h-3 w-3 mr-1" />Post
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tone Quick Select */}
            <div className="flex gap-2">
              {["witty", "professional", "provocative", "educational"].map((t) => (
                <Badge
                  key={t}
                  className={`cursor-pointer text-xs ${quickTone === t ? "bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]" : "bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-secondary)]"}`}
                  onClick={() => setQuickTone(t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Thread Builder Tab */}
        <TabsContent value="thread">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Build multi-part Twitter threads from a single topic. AI generates connected tweets that flow naturally.
            </p>
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3 space-y-1.5">
                    <Label className="text-xs text-[var(--color-forge-text-muted)]">Thread Topic</Label>
                    <Input
                      value={threadTopic}
                      onChange={(e) => setThreadTopic(e.target.value)}
                      placeholder="e.g., Everything I learned about startup growth in 2024"
                      className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--color-forge-text-muted)]">Length</Label>
                    <Select value={String(threadLength)} onValueChange={(v) => setThreadLength(Number(v))}>
                      <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 5, 7, 10].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} tweets</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={generateThread}
                    disabled={isGeneratingThread || !threadTopic}
                    className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
                  >
                    {isGeneratingThread ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                    ) : threadParts.length > 0 ? (
                      <><RefreshCw className="mr-2 h-4 w-4" />Regenerate Thread</>
                    ) : (
                      <><Wand2 className="mr-2 h-4 w-4" />Generate Thread</>
                    )}
                  </Button>
                  {threadParts.length > 0 && (
                    <Button variant="outline" onClick={copyThread} className="border-[var(--color-forge-border-default)]">
                      <Copy className="mr-2 h-4 w-4" />Copy Entire Thread
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Thread Preview */}
            {threadParts.length > 0 && (
              <div className="space-y-2">
                {threadParts.map((part, i) => (
                  <Card key={i} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-[10px] border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]">
                          {i + 1}/{threadParts.length}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{ color: part.length > 280 ? "var(--color-forge-error)" : "var(--color-forge-text-muted)" }}>
                            {part.length}/280
                          </span>
                          <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => { navigator.clipboard.writeText(part); toast.success("Tweet copied"); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--color-forge-text-primary)] whitespace-pre-wrap">{part}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Hashtag Research Tab */}
        <TabsContent value="hashtags">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Research relevant hashtags for your content. Get volume estimates and trending indicators.
            </p>
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-[var(--color-forge-text-muted)]">Topic</Label>
                    <Input
                      value={hashtagTopic}
                      onChange={(e) => setHashtagTopic(e.target.value)}
                      placeholder="e.g., AI automation, startup marketing"
                      onKeyDown={(e) => e.key === "Enter" && searchHashtags()}
                      className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--color-forge-text-muted)]">Platform</Label>
                    <Select value={hashtagPlatform} onValueChange={setHashtagPlatform}>
                      <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twitter">Twitter/X</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={searchHashtags} disabled={isSearchingHashtags || !hashtagTopic} className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]">
                  {isSearchingHashtags ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</> : <><Search className="mr-2 h-4 w-4" />Research Hashtags</>}
                </Button>
              </CardContent>
            </Card>

            {hashtagResults.length > 0 && (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {hashtagResults.map((tag, i) => (
                  <Card
                    key={i}
                    className="cursor-pointer border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] hover:border-[var(--color-forge-accent)] transition-colors"
                    onClick={() => { navigator.clipboard.writeText(tag.hashtag); toast.success(`${tag.hashtag} copied`); }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-[var(--color-forge-accent)]">{tag.hashtag}</p>
                        {tag.trending && <Badge className="text-[9px] bg-[rgba(239,68,68,0.15)] text-[var(--color-forge-error)]">Trending</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]">
                          {tag.volume}
                        </Badge>
                        <span className="text-[10px] text-[var(--color-forge-text-muted)]">{tag.relevance}% relevant</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Engagement Guide Tab */}
        <TabsContent value="guide">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Proven strategies for growing your Twitter presence. Apply these consistently for steady growth.
            </p>
            {GROWTH_TIPS.map((section) => (
              <Card key={section.category} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">{section.category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {section.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                      <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-forge-accent)]" />
                      <p className="text-xs text-[var(--color-forge-text-secondary)]">{tip}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <TweetComposer open={composerOpen} onClose={() => setComposerOpen(false)} isThread={composerThread} />
    </div>
  );
}
