"use client";

import { useState, useCallback } from "react";
import {
  Rocket,
  Code,
  Users,
  Smartphone,
  Wand2,
  Copy,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LaunchChecklist } from "@/components/growth/launch-checklist";
import type { LaunchChecklistItem } from "@/types";

// ─── Product Hunt Data ──────────────────────────────────────────────────────

const INITIAL_PH_CHECKLIST: LaunchChecklistItem[] = [
  // Pre-launch
  { id: "1", phase: "pre_launch", task: "Create Product Hunt maker profile", description: "Complete profile with photo, bio, and links to previous projects", completed: false },
  { id: "2", phase: "pre_launch", task: "Build a coming-soon page", description: "Collect early supporters' emails for launch day notification", completed: false },
  { id: "3", phase: "pre_launch", task: "Prepare 5+ high-quality screenshots/GIF", description: "Show key features with clear, annotated visuals", completed: false },
  { id: "4", phase: "pre_launch", task: "Write compelling tagline (60 chars)", description: "Focus on the benefit, not the feature. Use the tagline generator below", completed: false },
  { id: "5", phase: "pre_launch", task: "Prepare maker comment", description: "Tell your story: why you built it, who it's for, what's next", completed: false },
  { id: "6", phase: "pre_launch", task: "Line up 10+ supporters for launch day", description: "Friends, colleagues, early users who will upvote and comment authentically", completed: false },
  { id: "7", phase: "pre_launch", task: "Schedule launch for Tuesday-Thursday", description: "These days get most traffic. Launch at 12:01 AM PT for maximum runway", completed: false },
  { id: "8", phase: "pre_launch", task: "Prepare social media announcements", description: "Draft tweets, LinkedIn posts, and Reddit posts for launch day", completed: false },
  // Launch day
  { id: "9", phase: "launch_day", task: "Post maker comment immediately", description: "Be first comment on your own product. Share your story authentically", completed: false },
  { id: "10", phase: "launch_day", task: "Share on all social platforms", description: "LinkedIn, Twitter, Reddit, Indie Hackers, Facebook groups", completed: false },
  { id: "11", phase: "launch_day", task: "Email your list", description: "Send launch announcement to all collected emails", completed: false },
  { id: "12", phase: "launch_day", task: "Reply to EVERY comment", description: "Fast, thoughtful replies show engagement and boost ranking", completed: false },
  { id: "13", phase: "launch_day", task: "Monitor throughout the day", description: "Check ranking, respond to questions, fix any reported issues", completed: false },
  // Post-launch
  { id: "14", phase: "post_launch", task: "Share results on social media", description: "Post your launch metrics — the community loves transparency", completed: false },
  { id: "15", phase: "post_launch", task: "Follow up with new users", description: "Send onboarding emails, ask for feedback, offer help", completed: false },
  { id: "16", phase: "post_launch", task: "Write a launch retrospective", description: "Blog post about what worked, what didn't — great content and SEO", completed: false },
  { id: "17", phase: "post_launch", task: "Apply for badges/collections", description: "Product of the Day/Week badges drive ongoing traffic", completed: false },
];

// ─── HN Tips ────────────────────────────────────────────────────────────────

const HN_TIPS = [
  { category: "Title Rules", tips: [
    "Use 'Show HN:' prefix for things you've made",
    "Keep titles factual and descriptive — no marketing speak",
    "No emojis, no ALL CAPS, no exclamation marks",
    "Aim for 80 characters or less",
    "Avoid superlatives (best, amazing, revolutionary)",
  ]},
  { category: "Content Rules", tips: [
    "Lead with the technical problem you're solving",
    "Be honest about limitations and trade-offs",
    "Show you understand the HN community values (privacy, open source, technical depth)",
    "Include technical details — stack, architecture decisions, benchmarks",
    "Invite feedback specifically: 'Would love feedback on X approach'",
  ]},
  { category: "Timing", tips: [
    "Best: Weekday mornings US Eastern (8-10 AM ET)",
    "Avoid weekends — lower traffic",
    "Tuesday-Thursday get the most eyeballs",
    "New posts need quick initial upvotes to gain traction",
  ]},
  { category: "Engagement", tips: [
    "Reply to every comment thoughtfully and quickly",
    "Accept criticism gracefully — it's expected and respected",
    "Don't be defensive — acknowledge valid points",
    "Share follow-up data if your post gains traction",
    "Engage in other HN threads regularly, not just when launching",
  ]},
];

// ─── Indie Hackers Tips ─────────────────────────────────────────────────────

const IH_POST_IDEAS = [
  "Monthly revenue update with real numbers",
  "How I got my first 100 users (specific tactics)",
  "Technical architecture decisions and trade-offs",
  "Marketing channels that actually work for us",
  "Mistakes I made and what I'd do differently",
  "Our pricing strategy journey",
  "How I handle customer support as a solo founder",
  "The tools/stack I use to run my business",
  "Lessons from failing at [previous attempt]",
  "AMA: Building [product] to [milestone]",
];

// ─── ASO Data ───────────────────────────────────────────────────────────────

const ASO_CHECKLIST = [
  { task: "Research top 20 keywords for your category", important: true },
  { task: "Optimize app title (30 chars, primary keyword first)", important: true },
  { task: "Write compelling subtitle (30 chars on iOS)", important: true },
  { task: "Craft keyword field (100 chars, comma-separated)", important: true },
  { task: "Write description with keywords in first 3 lines", important: true },
  { task: "Create 10 localized screenshots with captions", important: true },
  { task: "Add app preview video (15-30 seconds)", important: false },
  { task: "Set up A/B testing for icon and screenshots", important: false },
  { task: "Respond to all reviews (especially negative)", important: true },
  { task: "Localize listing for top 5 markets", important: false },
  { task: "Track keyword rankings weekly", important: false },
  { task: "Update screenshots with each major release", important: false },
];

const REVIEW_TEMPLATES = [
  { type: "Positive Review", template: "Thank you so much for the kind words, {name}! We're thrilled {product} is helping with {use_case}. We have some exciting updates coming soon that I think you'll love!" },
  { type: "Feature Request", template: "Great suggestion, {name}! We've added {feature} to our roadmap. In the meantime, you can try {workaround} to accomplish something similar. Stay tuned!" },
  { type: "Bug Report", template: "Sorry about this, {name}. We've identified the issue and our team is working on a fix. Could you email us at {support_email} so we can help resolve this for you directly?" },
  { type: "Negative Review", template: "We're sorry {product} didn't meet your expectations, {name}. We'd love to understand more about your experience. Could you reach out to {support_email}? We want to make this right." },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  // Product Hunt state
  const [phChecklist, setPhChecklist] = useState<LaunchChecklistItem[]>(INITIAL_PH_CHECKLIST);
  const [taglineTopic, setTaglineTopic] = useState("");
  const [generatedTagline, setGeneratedTagline] = useState("");
  const [makerCommentTopic, setMakerCommentTopic] = useState("");
  const [generatedMakerComment, setGeneratedMakerComment] = useState("");
  const [isGeneratingTagline, setIsGeneratingTagline] = useState(false);
  const [isGeneratingComment, setIsGeneratingComment] = useState(false);

  // HN state
  const [hnTitle, setHnTitle] = useState("");
  const [hnBody, setHnBody] = useState("");
  const [isOptimizingTitle, setIsOptimizingTitle] = useState(false);
  const [optimizedTitle, setOptimizedTitle] = useState("");

  // ASO state
  const [asoKeyword, setAsoKeyword] = useState("");
  const [appDescTopic, setAppDescTopic] = useState("");
  const [generatedAppDesc, setGeneratedAppDesc] = useState("");
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  const toggleChecklistItem = useCallback((id: string) => {
    setPhChecklist((prev) => prev.map((i) => i.id === id ? { ...i, completed: !i.completed } : i));
  }, []);

  const generateTagline = useCallback(async () => {
    if (!taglineTopic) { toast.error("Enter your product/topic"); return; }
    setIsGeneratingTagline(true);
    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "producthunt", contentType: "tagline", topic: taglineTopic }),
      });
      if (!response.ok) throw new Error("Generation failed");
      const result = await response.json();
      setGeneratedTagline(result.data.content);
      toast.success("Tagline generated");
    } catch { toast.error("Failed to generate tagline"); }
    finally { setIsGeneratingTagline(false); }
  }, [taglineTopic]);

  const generateMakerComment = useCallback(async () => {
    if (!makerCommentTopic) { toast.error("Enter your product info"); return; }
    setIsGeneratingComment(true);
    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "producthunt", contentType: "maker_comment", topic: makerCommentTopic, productName: makerCommentTopic }),
      });
      if (!response.ok) throw new Error("Generation failed");
      const result = await response.json();
      setGeneratedMakerComment(result.data.content);
      toast.success("Maker comment generated");
    } catch { toast.error("Failed to generate comment"); }
    finally { setIsGeneratingComment(false); }
  }, [makerCommentTopic]);

  const optimizeHNTitle = useCallback(async () => {
    if (!hnTitle) { toast.error("Enter a title"); return; }
    setIsOptimizingTitle(true);
    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "hackernews", contentType: "title", topic: hnTitle, additionalContext: "Optimize this Show HN title for the Hacker News audience. Keep it factual, concise, and technically descriptive." }),
      });
      if (!response.ok) throw new Error("Optimization failed");
      const result = await response.json();
      setOptimizedTitle(result.data.content);
      toast.success("Title optimized");
    } catch { toast.error("Failed to optimize title"); }
    finally { setIsOptimizingTitle(false); }
  }, [hnTitle]);

  const generateAppDescription = useCallback(async () => {
    if (!appDescTopic) { toast.error("Enter app info"); return; }
    setIsGeneratingDesc(true);
    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "appstore", contentType: "description", topic: appDescTopic, productName: appDescTopic }),
      });
      if (!response.ok) throw new Error("Generation failed");
      const result = await response.json();
      setGeneratedAppDesc(result.data.content);
      toast.success("App description generated");
    } catch { toast.error("Failed to generate description"); }
    finally { setIsGeneratingDesc(false); }
  }, [appDescTopic]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-forge-text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
          Growth Channels
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Launch strategies for Product Hunt, Hacker News, Indie Hackers, and App Store
        </p>
      </div>

      <Tabs defaultValue="producthunt" className="space-y-6">
        <TabsList className="bg-[var(--color-forge-bg-elevated)] border border-[var(--color-forge-border-default)]">
          <TabsTrigger value="producthunt" className="gap-1.5">
            <Rocket className="h-3.5 w-3.5" />
            Product Hunt
          </TabsTrigger>
          <TabsTrigger value="hackernews" className="gap-1.5">
            <Code className="h-3.5 w-3.5" />
            Hacker News
          </TabsTrigger>
          <TabsTrigger value="indiehackers" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Indie Hackers
          </TabsTrigger>
          <TabsTrigger value="aso" className="gap-1.5">
            <Smartphone className="h-3.5 w-3.5" />
            App Store / ASO
          </TabsTrigger>
        </TabsList>

        {/* Product Hunt Tab */}
        <TabsContent value="producthunt">
          <div className="space-y-6">
            {/* Launch Checklist */}
            <LaunchChecklist items={phChecklist} onToggle={toggleChecklistItem} />

            {/* Tagline Generator */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Tagline Generator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={taglineTopic} onChange={(e) => setTaglineTopic(e.target.value)} placeholder="Your product name or description" className="h-8 text-xs flex-1 border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                  <Button size="sm" onClick={generateTagline} disabled={isGeneratingTagline} className="h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]">
                    {isGeneratingTagline ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  </Button>
                </div>
                {generatedTagline && (
                  <div className="flex items-center justify-between rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-3">
                    <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">{generatedTagline}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--color-forge-text-muted)]">{generatedTagline.length}/60</span>
                      <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => { navigator.clipboard.writeText(generatedTagline); toast.success("Copied"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Maker Comment Generator */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Maker Comment Generator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={makerCommentTopic} onChange={(e) => setMakerCommentTopic(e.target.value)} placeholder="Your product name" className="h-8 text-xs flex-1 border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                  <Button size="sm" onClick={generateMakerComment} disabled={isGeneratingComment} className="h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]">
                    {isGeneratingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  </Button>
                </div>
                {generatedMakerComment && (
                  <div className="space-y-2">
                    <Textarea value={generatedMakerComment} onChange={(e) => setGeneratedMakerComment(e.target.value)} rows={6} className="text-xs resize-y border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]" />
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedMakerComment); toast.success("Copied"); }} className="h-7 text-xs border-[var(--color-forge-border-default)]">
                      <Copy className="h-3 w-3 mr-1" />Copy
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Launch Timeline */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Launch Day Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-0">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-[var(--color-forge-border-default)]" />
                  {[
                    { time: "12:01 AM PT", action: "Product goes live on Product Hunt", icon: Rocket },
                    { time: "6:00 AM PT", action: "Post maker comment, share on social media", icon: Wand2 },
                    { time: "8:00 AM PT", action: "Email your subscriber list", icon: CheckCircle2 },
                    { time: "10:00 AM PT", action: "Check-in: respond to all comments", icon: Clock },
                    { time: "12:00 PM PT", action: "Share update on Twitter/LinkedIn with early results", icon: TrendingUp },
                    { time: "3:00 PM PT", action: "Second social media push with social proof", icon: Users },
                    { time: "6:00 PM PT", action: "Final push: thank supporters, share rankings", icon: Rocket },
                    { time: "11:59 PM PT", action: "Voting closes — celebrate and plan follow-up", icon: CheckCircle2 },
                  ].map((item, i) => (
                    <div key={i} className="relative flex gap-4 py-2 pl-1">
                      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-forge-bg-card)] border border-[var(--color-forge-accent)]">
                        <item.icon className="h-3 w-3 text-[var(--color-forge-accent)]" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)] shrink-0">{item.time}</Badge>
                        <p className="text-xs text-[var(--color-forge-text-secondary)]">{item.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hacker News Tab */}
        <TabsContent value="hackernews">
          <div className="space-y-4">
            {/* Title Optimizer */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Show HN Title Optimizer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--color-forge-text-muted)]">Your Title</Label>
                  <div className="flex gap-2">
                    <Input value={hnTitle} onChange={(e) => setHnTitle(e.target.value)} placeholder="Show HN: My cool project" className="h-8 text-xs flex-1 border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                    <Button size="sm" onClick={optimizeHNTitle} disabled={isOptimizingTitle} className="h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]">
                      {isOptimizingTitle ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                      Optimize
                    </Button>
                  </div>
                  <span className="text-[10px] text-[var(--color-forge-text-muted)]">{hnTitle.length}/80 characters</span>
                </div>
                {optimizedTitle && (
                  <div className="flex items-center justify-between rounded-lg border border-[var(--color-forge-success)] bg-[var(--color-forge-bg-elevated)] p-3">
                    <p className="text-sm text-[var(--color-forge-text-primary)]">{optimizedTitle}</p>
                    <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => { navigator.clipboard.writeText(optimizedTitle); toast.success("Copied"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Post Body Editor */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Post Body Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={hnBody} onChange={(e) => setHnBody(e.target.value)} placeholder="Tell HN about what you built, the technical approach, and what feedback you're looking for..." rows={8} className="text-xs resize-y border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(hnBody); toast.success("Copied"); }} className="h-7 text-xs border-[var(--color-forge-border-default)]">
                    <Copy className="h-3 w-3 mr-1" />Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open("https://news.ycombinator.com/submit", "_blank")} className="h-7 text-xs border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]">
                    <ExternalLink className="h-3 w-3 mr-1" />Submit to HN
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* HN Culture Tips */}
            {HN_TIPS.map((section) => (
              <Card key={section.category} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">{section.category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {section.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-forge-warning)]" />
                      <p className="text-xs text-[var(--color-forge-text-secondary)]">{tip}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Indie Hackers Tab */}
        <TabsContent value="indiehackers">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Build authentic presence on Indie Hackers through transparency and community engagement.
            </p>

            {/* Engagement Plan */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Weekly Engagement Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { day: "Monday", action: "Comment on 3-5 milestone posts with specific, helpful feedback" },
                  { day: "Tuesday", action: "Share a quick tip or learning from your week" },
                  { day: "Wednesday", action: "Engage in 2-3 group discussions with genuine insights" },
                  { day: "Thursday", action: "Post a progress update or ask-for-feedback post" },
                  { day: "Friday", action: "Share your weekly metrics and learnings (build in public)" },
                ].map((item) => (
                  <div key={item.day} className="flex items-center gap-3 rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                    <Badge variant="outline" className="text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)] w-20 justify-center shrink-0">{item.day}</Badge>
                    <p className="text-xs text-[var(--color-forge-text-secondary)]">{item.action}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Post Ideas */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Post Ideas Generator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {IH_POST_IDEAS.map((idea, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[var(--color-forge-accent)]" />
                      <p className="text-xs text-[var(--color-forge-text-secondary)]">{idea}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-1 shrink-0" onClick={() => { navigator.clipboard.writeText(idea); toast.success("Idea copied"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Cross-Promotion Strategy */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Cross-Promotion Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { from: "Indie Hackers", to: "Twitter", action: "Repurpose IH posts as Twitter threads. Add 'Originally shared on @IndieHackers'" },
                  { from: "Indie Hackers", to: "LinkedIn", action: "Share your revenue milestones as LinkedIn posts with professional framing" },
                  { from: "Indie Hackers", to: "Reddit", action: "Cross-post insights to r/startups, r/SaaS, r/entrepreneur (rewrite for each sub)" },
                  { from: "Indie Hackers", to: "Blog", action: "Turn popular IH posts into detailed blog posts for SEO traffic" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge className="text-[10px] bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)]">{item.from}</Badge>
                      <span className="text-[10px] text-[var(--color-forge-text-muted)]">→</span>
                      <Badge variant="outline" className="text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]">{item.to}</Badge>
                    </div>
                    <p className="text-xs text-[var(--color-forge-text-secondary)]">{item.action}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* App Store / ASO Tab */}
        <TabsContent value="aso">
          <div className="space-y-4">
            {/* ASO Checklist */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">ASO Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {ASO_CHECKLIST.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-forge-text-muted)]" />
                    <p className="text-xs text-[var(--color-forge-text-secondary)] flex-1">{item.task}</p>
                    {item.important && <Badge className="shrink-0 text-[9px] bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)]">Important</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Keyword Research */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Keyword Research</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={asoKeyword} onChange={(e) => setAsoKeyword(e.target.value)} placeholder="Enter seed keyword (e.g., task manager, habit tracker)" className="h-8 text-xs flex-1 border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                  <Button size="sm" className="h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]" onClick={() => { toast.info("Connect ASO tool API for live keyword data. Using template suggestions."); }}>
                    Research
                  </Button>
                </div>
                <p className="text-[10px] text-[var(--color-forge-text-muted)]">Tip: Use tools like App Annie, Sensor Tower, or AppFollow for real keyword volume data.</p>
              </CardContent>
            </Card>

            {/* App Description Generator */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">App Description Generator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={appDescTopic} onChange={(e) => setAppDescTopic(e.target.value)} placeholder="Your app name and what it does" className="h-8 text-xs flex-1 border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                  <Button size="sm" onClick={generateAppDescription} disabled={isGeneratingDesc} className="h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]">
                    {isGeneratingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                    Generate
                  </Button>
                </div>
                {generatedAppDesc && (
                  <div className="space-y-2">
                    <Textarea value={generatedAppDesc} onChange={(e) => setGeneratedAppDesc(e.target.value)} rows={6} className="text-xs resize-y border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]" />
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedAppDesc); toast.success("Copied"); }} className="h-7 text-xs border-[var(--color-forge-border-default)]">
                      <Copy className="h-3 w-3 mr-1" />Copy
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Review Response Templates */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Review Response Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {REVIEW_TEMPLATES.map((template) => (
                  <div key={template.type} className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-[var(--color-forge-text-primary)]">{template.type}</p>
                      <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => { navigator.clipboard.writeText(template.template); toast.success("Template copied"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--color-forge-text-muted)]">{template.template}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
