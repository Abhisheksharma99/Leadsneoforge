"use client";

import { useState } from "react";
import {
  BookOpen,
  Target,
  Calendar,
  MessageSquare,
  TrendingUp,
  Users,
  Zap,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  AlertTriangle,
  Rocket,
  Linkedin,
  Twitter,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Playbook Data ──────────────────────────────────────────────────────────

const WEEKLY_PLAN = [
  {
    day: "Monday",
    tasks: [
      { action: "Scan Reddit for new keyword matches", tool: "Reddit Monitor > Live Scanner", time: "15 min" },
      { action: "Review suggested keywords, add relevant ones", tool: "Reddit Monitor > Suggest Keywords", time: "10 min" },
      { action: "Generate 3-5 contextual replies for top matches", tool: "Click Wand icon on posts", time: "20 min" },
      { action: "Post replies on Reddit (space 2+ hours apart)", tool: "Copy reply > Open Post", time: "5 min" },
    ],
  },
  {
    day: "Tuesday",
    tasks: [
      { action: "Check latest posts in target subreddits", tool: "Reddit Monitor > Latest Posts", time: "10 min" },
      { action: "Engage with 3-5 posts (pure value, no promotion)", tool: "Direct on Reddit", time: "30 min" },
      { action: "Create LinkedIn thought leadership post", tool: "LinkedIn Hub > Post Composer", time: "15 min" },
      { action: "Schedule 1-2 content pieces for the week", tool: "Content Hub", time: "15 min" },
    ],
  },
  {
    day: "Wednesday",
    tasks: [
      { action: "Create a value-first Reddit post (tutorial/insight)", tool: "Reddit Monitor > Compose Post", time: "30 min" },
      { action: "Post Twitter thread on trending topic", tool: "Twitter/X Hub > Thread Builder", time: "20 min" },
      { action: "Send 5 LinkedIn connection requests to leads", tool: "LinkedIn Hub > Outreach", time: "15 min" },
      { action: "Update directory submissions", tool: "Directories", time: "15 min" },
      { action: "Check n8n workflow execution health", tool: "Workflows", time: "5 min" },
    ],
  },
  {
    day: "Thursday",
    tasks: [
      { action: "Scan Reddit with broader keywords", tool: "Reddit Monitor > Live Scanner", time: "15 min" },
      { action: "Generate replies for new high-score posts", tool: "Click Wand icon on posts", time: "20 min" },
      { action: "Review and refine reply tone for each subreddit", tool: "Reply Generator dialog", time: "10 min" },
    ],
  },
  {
    day: "Friday",
    tasks: [
      { action: "Review week's engagement metrics", tool: "Overview dashboard", time: "10 min" },
      { action: "Analyze which keywords drove most matches", tool: "Reddit Monitor > Keyword Matches", time: "10 min" },
      { action: "Review outreach pipeline and follow up", tool: "Outreach Hub > Lead Board", time: "15 min" },
      { action: "Plan next week's content calendar", tool: "Content Hub", time: "20 min" },
      { action: "Submit to 2-3 new directories", tool: "Directories", time: "15 min" },
    ],
  },
];

const REPLY_STRATEGIES = [
  {
    title: "The Helpful Expert",
    description: "Answer the question thoroughly first, then mention your tool as one option among several.",
    example: `"For converting legacy STEP files, you have a few options. AutoCAD can handle basic conversions but struggles with complex assemblies. FreeCAD has improved a lot but still has compatibility gaps. I've been using [Product] for this specifically because it handles the edge cases well — parametric features, assembly constraints, etc. But honestly, for simple parts, FreeCAD might be all you need."`,
    when: "Questions about tools, comparisons, how-to posts",
    tone: "helpful" as const,
  },
  {
    title: "The Experienced Peer",
    description: "Share a personal experience that naturally involves your product.",
    example: `"I had the exact same problem last month. What ended up working was [solving the core problem first]. During that process I also tried [Product] which simplified the [specific step]. The key thing though is making sure your [technical detail] is set up correctly before anything else."`,
    when: "Problem/help posts, troubleshooting threads",
    tone: "casual" as const,
  },
  {
    title: "The Data Sharer",
    description: "Share real metrics, benchmarks, or comparisons. People love data.",
    example: `"I benchmarked a few options for this workflow:\n- Tool A: 45 sec per file, 85% accuracy\n- Tool B: 30 sec, 78% accuracy  \n- [Product]: 12 sec, 94% accuracy\n\nThe difference really shows up with complex assemblies. For simple parts, any of these work fine."`,
    when: "Comparison posts, 'which is better' threads",
    tone: "technical" as const,
  },
  {
    title: "The Resource Compiler",
    description: "Create a genuinely useful list of resources, including but not limited to your product.",
    example: `"Here's what I've found works for [topic]:\n\n1. [Free resource] — great for beginners\n2. [Open source tool] — best for [use case]\n3. [Product] — handles [specific advantage]\n4. [Other tool] — if you need [different feature]\n\nI'd start with #1 to learn the basics, then move to whatever fits your workflow."`,
    when: "Recommendation threads, 'getting started' posts",
    tone: "helpful" as const,
  },
];

const DO_DONT = {
  do: [
    "Provide genuine value in every reply — answer the question first",
    "Space out your posts: max 2-3 promotional replies per day across all subreddits",
    "Engage in non-promotional discussions regularly (aim for 5:1 value-to-promotion ratio)",
    "Customize tone per subreddit (technical in r/engineering, casual in r/3Dprinting)",
    "Disclose your affiliation if directly asked",
    "Build karma through helpful comments before promoting",
    "Use the reply generator's 'helpful' and 'technical' tones — they sound most natural",
    "Track which reply strategies get upvoted and refine your approach",
    "Reply to posts within 2-6 hours for maximum visibility",
    "Upvote and engage with other comments in threads you post in",
  ],
  dont: [
    "Never copy-paste the same reply across multiple posts",
    "Never use exclamation points excessively or 'game changer' language",
    "Never reply to posts older than 48 hours (low visibility, looks desperate)",
    "Never post in subreddits where self-promotion is explicitly banned without reading rules",
    "Never use brand new accounts for promotion (build history first)",
    "Never mention your product if it genuinely doesn't solve the poster's problem",
    "Never post more than once per subreddit per day",
    "Never argue with people who criticize your product — acknowledge and move on",
    "Never use the 'enthusiastic' tone in technical subreddits",
    "Never DM users unsolicited about your product",
  ],
};

const GROWTH_PHASES = [
  {
    phase: "Phase 1: Foundation",
    duration: "Weeks 1-2",
    goal: "Build Reddit presence and karma",
    icon: Target,
    tasks: [
      "Create accounts on target subreddits (don't post yet)",
      "Spend 30 min/day reading and understanding each community's culture",
      "Make 3-5 purely helpful comments per day (zero promotion)",
      "Accumulate 100+ karma before any promotional activity",
      "Set up Reddit Monitor keywords and subreddits in the platform",
      "Configure n8n workflows for automated scanning",
    ],
  },
  {
    phase: "Phase 2: Soft Launch",
    duration: "Weeks 3-4",
    goal: "Start value-driven engagement with subtle mentions",
    icon: MessageSquare,
    tasks: [
      "Begin using Reply Generator on high-relevance posts (1-2/day)",
      "Use 'Helpful Expert' strategy primarily",
      "Always answer the question first, mention product second",
      "Post 1 value-first article per week (tutorial, comparison, insight)",
      "Submit to 5 directories per week",
      "Track engagement metrics in Overview dashboard",
    ],
  },
  {
    phase: "Phase 3: Scale",
    duration: "Weeks 5-8",
    goal: "Increase visibility while maintaining authenticity",
    icon: TrendingUp,
    tasks: [
      "Expand keyword list using Suggest Keywords feature",
      "Increase to 3-5 contextual replies per day",
      "Rotate between all 4 reply strategies",
      "Create 2 value posts per week across different subreddits",
      "Build relationships with active community members",
      "A/B test different tones and approaches",
      "Start cross-promoting content (Reddit -> Blog -> Twitter)",
    ],
  },
  {
    phase: "Phase 4: Multi-Platform Expansion",
    duration: "Weeks 9-12",
    goal: "Expand to LinkedIn, Twitter, and community platforms",
    icon: Globe,
    tasks: [
      "Set up LinkedIn Hub and publish 3 posts per week",
      "Build Twitter presence with daily tweets and weekly threads",
      "Launch outreach sequences for LinkedIn leads",
      "Prepare Product Hunt launch materials",
      "Post on Indie Hackers with build-in-public updates",
      "Cross-promote content across all platforms",
    ],
  },
  {
    phase: "Phase 5: Automate & Optimize",
    duration: "Weeks 13+",
    goal: "Systematize what works, build workflows for repetitive tasks",
    icon: Zap,
    tasks: [
      "Build n8n workflows for automated monitoring (Workflow Builder)",
      "Create campaign templates for recurring activities",
      "Set up automated keyword scanning every 6 hours",
      "Analyze which platforms/channels convert best",
      "Focus resources on top-performing channels",
      "Build a content library of proven templates for all platforms",
      "Automate outreach sequences with n8n workflows",
    ],
  },
];

const PLATFORM_PLAYBOOKS = [
  {
    platform: "LinkedIn",
    icon: Linkedin,
    cadence: "3 posts/week, 5 connections/day, 10 comments/day",
    strategy: [
      "Post Tue/Wed/Thu mornings for max reach",
      "Alternate between text, carousel, and poll formats",
      "Comment on 10 posts before publishing your own",
      "Use the Lead Finder to identify high-value connections",
      "Send personalized connection requests (never use default)",
      "Follow up with value content 3 days after connecting",
    ],
  },
  {
    platform: "Twitter/X",
    icon: Twitter,
    cadence: "3-5 tweets/day, 1 thread/week, 15 replies/day",
    strategy: [
      "Post quick takes throughout the day, thread on Tue or Wed",
      "Reply to 15+ accounts larger than yours with genuine insights",
      "Use trending hashtags when relevant (max 3 per tweet)",
      "Build in public: share metrics, learnings, behind-the-scenes",
      "Cross-promote LinkedIn content in Twitter-native format",
      "Run weekly polls to drive engagement and gather insights",
    ],
  },
  {
    platform: "Product Hunt",
    icon: Rocket,
    cadence: "1 launch, then ongoing engagement",
    strategy: [
      "Build supporter base 2-4 weeks before launch",
      "Launch Tuesday-Thursday at 12:01 AM PT",
      "Reply to every comment within 30 minutes",
      "Share launch on all social platforms same day",
      "Write a launch retrospective for content leverage",
      "Use the Launch Checklist in Growth Channels",
    ],
  },
  {
    platform: "Reddit",
    icon: MessageSquare,
    cadence: "2-3 replies/day, 1 post/week, daily reading",
    strategy: [
      "Build karma with pure value replies for 2 weeks first",
      "Use Reply Generator for contextual, non-promotional replies",
      "Post tutorials and insights (5:1 value-to-promotion ratio)",
      "Customize tone per subreddit community culture",
      "Never post the same reply in multiple threads",
      "Track which keywords and subreddits convert best",
    ],
  },
];

// ─── Page Component ───────────────────────────────────────────────────────────

export default function PlaybookPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold text-[var(--color-forge-text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Marketing Playbook
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Step-by-step strategy for authentic community marketing using FlowForge
        </p>
      </div>

      <Tabs defaultValue="plan" className="space-y-6">
        <TabsList className="bg-[var(--color-forge-bg-elevated)] border border-[var(--color-forge-border-default)]">
          <TabsTrigger value="plan" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Weekly Plan
          </TabsTrigger>
          <TabsTrigger value="strategies" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            Reply Strategies
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Do&apos;s & Don&apos;ts
          </TabsTrigger>
          <TabsTrigger value="growth" className="gap-1.5">
            <Rocket className="h-3.5 w-3.5" />
            Growth Roadmap
          </TabsTrigger>
          <TabsTrigger value="platforms" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Platform Playbooks
          </TabsTrigger>
        </TabsList>

        {/* Weekly Plan */}
        <TabsContent value="plan">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Follow this weekly rhythm for consistent, sustainable marketing. Total time: ~3 hours/week.
            </p>
            {WEEKLY_PLAN.map((day) => (
              <Card key={day.day} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">
                    {day.day}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {day.tasks.map((task, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2"
                      >
                        <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-forge-accent)]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-forge-text-primary)]">
                            {task.action}
                          </p>
                          <p className="text-xs text-[var(--color-forge-text-muted)] mt-0.5">
                            {task.tool}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                        >
                          {task.time}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Reply Strategies */}
        <TabsContent value="strategies">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Use these proven strategies when generating replies. The Reply Generator (wand icon) uses these principles automatically.
            </p>
            {REPLY_STRATEGIES.map((strategy) => (
              <Card key={strategy.title} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-[var(--color-forge-text-primary)]">
                      {strategy.title}
                    </CardTitle>
                    <Badge className="bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)] text-[10px]">
                      {strategy.tone} tone
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-[var(--color-forge-text-secondary)]">
                    {strategy.description}
                  </p>
                  <div className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-3">
                    <p className="text-xs font-medium text-[var(--color-forge-text-muted)] mb-1">
                      Example reply:
                    </p>
                    <p className="text-sm text-[var(--color-forge-text-secondary)] whitespace-pre-wrap italic">
                      {strategy.example}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-forge-text-muted)]">
                    <Target className="h-3 w-3" />
                    <span>Best for: {strategy.when}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Do's & Don'ts */}
        <TabsContent value="rules">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-[rgba(52,211,153,0.3)] bg-[var(--color-forge-bg-card)]">
              <CardHeader>
                <CardTitle className="text-[var(--color-forge-success)] flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Do
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {DO_DONT.do.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-forge-success)]" />
                      <p className="text-sm text-[var(--color-forge-text-secondary)]">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[rgba(239,68,68,0.3)] bg-[var(--color-forge-bg-card)]">
              <CardHeader>
                <CardTitle className="text-[var(--color-forge-error)] flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Don&apos;t
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {DO_DONT.dont.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-forge-error)]" />
                      <p className="text-sm text-[var(--color-forge-text-secondary)]">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Growth Roadmap */}
        <TabsContent value="growth">
          <div className="space-y-6">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              A 9-week ramp-up plan from zero presence to sustainable growth engine.
            </p>
            {GROWTH_PHASES.map((phase, idx) => (
              <Card key={phase.phase} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-forge-accent-muted)]">
                      <phase.icon className="h-5 w-5 text-[var(--color-forge-accent)]" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-[var(--color-forge-text-primary)]">
                        {phase.phase}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]">
                          {phase.duration}
                        </Badge>
                        <span className="text-xs text-[var(--color-forge-text-muted)]">
                          Goal: {phase.goal}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {phase.tasks.map((task, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-forge-text-muted)]" />
                        <p className="text-sm text-[var(--color-forge-text-secondary)]">{task}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Platform Playbooks */}
        <TabsContent value="platforms">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Platform-specific strategies for consistent growth across all channels.
            </p>
            {PLATFORM_PLAYBOOKS.map((playbook) => (
              <Card key={playbook.platform} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-forge-accent-muted)]">
                      <playbook.icon className="h-5 w-5 text-[var(--color-forge-accent)]" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-[var(--color-forge-text-primary)]">
                        {playbook.platform}
                      </CardTitle>
                      <p className="text-xs text-[var(--color-forge-text-muted)] mt-0.5">
                        Cadence: {playbook.cadence}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {playbook.strategy.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-forge-text-muted)]" />
                        <p className="text-sm text-[var(--color-forge-text-secondary)]">{item}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
