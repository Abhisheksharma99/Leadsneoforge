"use client";

import { useState, useCallback } from "react";
import {
  Linkedin,
  Search,
  UserPlus,
  BarChart3,
  Wand2,
  Copy,
  ExternalLink,
  Clock,
  TrendingUp,
  CheckCircle2,
  Plus,
  Users,
  Building2,
  Briefcase,
  Trash2,
  Info,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LinkedInPostComposer } from "@/components/linkedin/post-composer";
import { OutreachGenerator } from "@/components/linkedin/outreach-generator";
import { useLeads, useAddLead, useDeleteLead } from "@/hooks/use-leads";

// ─── Static Data (Industry Benchmarks) ─────────────────────────────────────

const BEST_POSTING_TIMES = [
  { day: "Tuesday", time: "8:00 AM", engagement: 95 },
  { day: "Wednesday", time: "9:00 AM", engagement: 90 },
  { day: "Thursday", time: "10:00 AM", engagement: 88 },
  { day: "Tuesday", time: "12:00 PM", engagement: 82 },
  { day: "Monday", time: "8:00 AM", engagement: 78 },
  { day: "Wednesday", time: "5:00 PM", engagement: 75 },
];

const CONTENT_EFFECTIVENESS = [
  { type: "Carousel", engagement: 95, reach: "3x" },
  { type: "Poll", engagement: 88, reach: "2.5x" },
  { type: "Text + Image", engagement: 82, reach: "2x" },
  { type: "Video", engagement: 78, reach: "2.2x" },
  { type: "Text Only", engagement: 65, reach: "1x" },
  { type: "Article/Link", engagement: 55, reach: "0.8x" },
];

const PROFILE_CHECKLIST = [
  { task: "Professional headshot (face visible, good lighting)", important: true },
  { task: "Custom banner image with value proposition", important: true },
  { task: "Headline uses keywords + value statement (not just job title)", important: true },
  { task: "About section tells your story with CTA", important: true },
  { task: "Featured section with top content/links", important: false },
  { task: "Experience section with quantified achievements", important: false },
  { task: "Skills section with relevant keywords (50+)", important: false },
  { task: "Recommendations from clients/colleagues (5+)", important: false },
  { task: "Custom URL (linkedin.com/in/yourname)", important: false },
  { task: "Creator mode enabled for content visibility", important: true },
];

const ENGAGEMENT_BENCHMARKS = [
  { metric: "Impressions per post", beginner: "200-500", intermediate: "500-2K", advanced: "2K-10K+" },
  { metric: "Engagement rate", beginner: "2-3%", intermediate: "3-5%", advanced: "5-10%+" },
  { metric: "Connection acceptance", beginner: "30-40%", intermediate: "40-60%", advanced: "60-80%" },
  { metric: "InMail response rate", beginner: "10-15%", intermediate: "15-25%", advanced: "25-40%" },
  { metric: "Weekly profile views", beginner: "50-100", intermediate: "100-500", advanced: "500-2K+" },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LinkedInPage() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachTarget, setOutreachTarget] = useState<{ name: string; title: string; company: string } | null>(null);

  // Lead Finder state — manual entry form fields
  const [addName, setAddName] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [addIndustry, setAddIndustry] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Leads from API
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const addLeadMutation = useAddLead();
  const deleteLeadMutation = useDeleteLead();

  // Filter to LinkedIn leads only
  const linkedInLeads = leads.filter((l) => l.platform === "linkedin");

  const handleAddLead = useCallback(() => {
    if (!addName.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!addTitle.trim()) {
      toast.error("Job title is required");
      return;
    }

    addLeadMutation.mutate(
      {
        name: addName.trim(),
        title: addTitle.trim(),
        company: addCompany.trim(),
        platform: "linkedin",
        status: "new",
        score: 0,
        notes: addIndustry.trim() ? `Industry: ${addIndustry.trim()}` : "",
      },
      {
        onSuccess: () => {
          toast.success(`Lead "${addName.trim()}" added`);
          setAddName("");
          setAddTitle("");
          setAddCompany("");
          setAddIndustry("");
          setShowAddForm(false);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to add lead");
        },
      }
    );
  }, [addName, addTitle, addCompany, addIndustry, addLeadMutation]);

  const handleDeleteLead = useCallback(
    (id: string, name: string) => {
      deleteLeadMutation.mutate(id, {
        onSuccess: () => toast.success(`Removed "${name}"`),
        onError: (err) => toast.error(err.message || "Failed to remove lead"),
      });
    },
    [deleteLeadMutation]
  );

  const openOutreachForLead = useCallback((lead: { name: string; title: string; company: string }) => {
    setOutreachTarget(lead);
    setOutreachOpen(true);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-forge-text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
          LinkedIn Hub
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Create posts, find leads, and manage outreach on LinkedIn
        </p>
      </div>

      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList className="bg-[var(--color-forge-bg-elevated)] border border-[var(--color-forge-border-default)]">
          <TabsTrigger value="compose" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Post Composer
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Lead Finder
          </TabsTrigger>
          <TabsTrigger value="outreach" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Outreach
          </TabsTrigger>
          <TabsTrigger value="tips" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Performance Tips
          </TabsTrigger>
        </TabsList>

        {/* Post Composer Tab */}
        <TabsContent value="compose">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Create engaging LinkedIn posts with AI assistance. Choose your post type and tone, then let the generator do the heavy lifting.
            </p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {(["text", "article", "carousel", "poll"] as const).map((type) => (
                <Card
                  key={type}
                  className="cursor-pointer border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] hover:border-[var(--color-forge-accent)] transition-colors"
                  onClick={() => setComposerOpen(true)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-forge-accent-muted)]">
                      <Linkedin className="h-5 w-5 text-[var(--color-forge-accent)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--color-forge-text-primary)] capitalize">{type} Post</p>
                    <p className="text-[10px] text-[var(--color-forge-text-muted)] mt-1">
                      {type === "text" ? "Thought leadership" : type === "article" ? "Long-form content" : type === "carousel" ? "Slide-by-slide" : "Engage your audience"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button onClick={() => setComposerOpen(true)} className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]">
              <Wand2 className="mr-2 h-4 w-4" />
              Open Post Composer
            </Button>
          </div>
        </TabsContent>

        {/* Lead Finder Tab */}
        <TabsContent value="leads">
          <div className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-4 py-3">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-forge-info)]" />
              <div>
                <p className="text-sm text-[var(--color-forge-text-secondary)]">
                  LinkedIn API integration coming soon. Add leads manually below to track and manage your LinkedIn outreach targets.
                </p>
              </div>
            </div>

            {/* Add Lead Button / Form */}
            {!showAddForm ? (
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            ) : (
              <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Add New Lead</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[var(--color-forge-text-muted)] flex items-center gap-1">
                        <Users className="h-3 w-3" /> Name *
                      </Label>
                      <Input
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        placeholder="e.g., Jane Smith"
                        className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[var(--color-forge-text-muted)] flex items-center gap-1">
                        <Briefcase className="h-3 w-3" /> Job Title *
                      </Label>
                      <Input
                        value={addTitle}
                        onChange={(e) => setAddTitle(e.target.value)}
                        placeholder="e.g., VP of Engineering"
                        className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[var(--color-forge-text-muted)] flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Company
                      </Label>
                      <Input
                        value={addCompany}
                        onChange={(e) => setAddCompany(e.target.value)}
                        placeholder="e.g., Stripe"
                        className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[var(--color-forge-text-muted)] flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Industry
                      </Label>
                      <Input
                        value={addIndustry}
                        onChange={(e) => setAddIndustry(e.target.value)}
                        placeholder="e.g., SaaS, FinTech"
                        className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleAddLead}
                      disabled={addLeadMutation.isPending}
                      className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
                    >
                      {addLeadMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Save Lead
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false);
                        setAddName("");
                        setAddTitle("");
                        setAddCompany("");
                        setAddIndustry("");
                      }}
                      className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Leads List */}
            {leadsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--color-forge-accent)]" />
                <span className="ml-2 text-sm text-[var(--color-forge-text-muted)]">Loading leads...</span>
              </div>
            ) : linkedInLeads.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {linkedInLeads.map((lead) => (
                  <Card key={lead.id} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">{lead.name}</p>
                          <p className="text-xs text-[var(--color-forge-text-muted)]">{lead.title}</p>
                          <p className="text-xs text-[var(--color-forge-text-muted)]">
                            {lead.company}
                            {lead.notes ? ` · ${lead.notes.replace(/^Industry:\s*/i, "")}` : ""}
                          </p>
                        </div>
                        <Badge
                          className={
                            lead.status === "new"
                              ? "bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-info)] text-[10px]"
                              : lead.status === "contacted"
                              ? "bg-[rgba(250,204,21,0.15)] text-[var(--color-forge-warning)] text-[10px]"
                              : lead.status === "replied"
                              ? "bg-[rgba(52,211,153,0.15)] text-[var(--color-forge-success)] text-[10px]"
                              : "bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-info)] text-[10px]"
                          }
                        >
                          {lead.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openOutreachForLead(lead)}
                          className="flex-1 h-7 text-xs border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]"
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Outreach
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteLead(lead.id, lead.name)}
                          disabled={deleteLeadMutation.isPending}
                          className="h-7 px-2 text-xs border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)] hover:text-red-400 hover:border-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-[var(--color-forge-text-muted)]">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No LinkedIn leads yet. Click &ldquo;Add Lead&rdquo; to get started.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Outreach Tab */}
        <TabsContent value="outreach">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Generate personalized outreach messages for connection requests, InMails, and follow-ups.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {([
                { type: "connection_request", label: "Connection Request", desc: "300 char personalized note", icon: UserPlus },
                { type: "inmail", label: "InMail", desc: "Detailed pitch message", icon: Linkedin },
                { type: "follow_up", label: "Follow-up", desc: "Re-engage after initial contact", icon: ExternalLink },
              ] as const).map((item) => (
                <Card
                  key={item.type}
                  className="cursor-pointer border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] hover:border-[var(--color-forge-accent)] transition-colors"
                  onClick={() => { setOutreachTarget(null); setOutreachOpen(true); }}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-forge-accent-muted)]">
                      <item.icon className="h-5 w-5 text-[var(--color-forge-accent)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">{item.label}</p>
                      <p className="text-[10px] text-[var(--color-forge-text-muted)]">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Outreach Templates */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Quick Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { name: "Mutual Connection Intro", body: "Hi {name}, I noticed we both know {mutual}. I'd love to connect and learn more about your work at {company}." },
                  { name: "Content Engagement", body: "Hi {name}, your post about {topic} really resonated with me. I've been working on something similar and would love to exchange ideas." },
                  { name: "Event Follow-up", body: "Hi {name}, great connecting at {event}! As discussed, I'd love to continue our conversation about {topic}. Free for a quick call this week?" },
                ].map((template) => (
                  <div key={template.name} className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-[var(--color-forge-text-primary)]">{template.name}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => { navigator.clipboard.writeText(template.body); toast.success("Template copied"); }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--color-forge-text-muted)]">{template.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tips Tab */}
        <TabsContent value="tips">
          <div className="space-y-6">
            {/* Industry benchmark note */}
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-4 py-3">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-forge-info)]" />
              <p className="text-xs text-[var(--color-forge-text-muted)]">
                Based on LinkedIn industry research and best practices. These are general benchmarks, not personalized analytics.
              </p>
            </div>

            {/* Best Posting Times */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)] flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[var(--color-forge-accent)]" />
                  Recommended Posting Times (Industry Average)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {BEST_POSTING_TIMES.map((slot, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-[var(--color-forge-text-secondary)]">{slot.day}</div>
                      <div className="w-20 text-xs text-[var(--color-forge-text-muted)]">{slot.time}</div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-[var(--color-forge-bg-elevated)]">
                          <div className="h-full rounded-full bg-[var(--color-forge-accent)]" style={{ width: `${slot.engagement}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-[var(--color-forge-text-muted)] w-10 text-right">{slot.engagement}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Content Effectiveness */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--color-forge-accent)]" />
                  Content Type Effectiveness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {CONTENT_EFFECTIVENESS.map((item) => (
                    <div key={item.type} className="flex items-center gap-3 rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                      <div className="w-28 text-xs font-medium text-[var(--color-forge-text-primary)]">{item.type}</div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-[var(--color-forge-bg-card)]">
                          <div className="h-full rounded-full bg-[var(--color-forge-accent)]" style={{ width: `${item.engagement}%` }} />
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]">
                        {item.reach} reach
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Profile Checklist */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)] flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-forge-accent)]" />
                  Profile Optimization Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {PROFILE_CHECKLIST.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-forge-text-muted)]" />
                    <p className="text-xs text-[var(--color-forge-text-secondary)]">{item.task}</p>
                    {item.important && <Badge className="ml-auto shrink-0 text-[9px] bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)]">Important</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Engagement Benchmarks */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)] flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[var(--color-forge-accent)]" />
                  Industry Engagement Benchmarks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-forge-border-default)]">
                        <th className="pb-2 text-left text-[var(--color-forge-text-muted)] font-medium">Metric</th>
                        <th className="pb-2 text-center text-[var(--color-forge-text-muted)] font-medium">Beginner</th>
                        <th className="pb-2 text-center text-[var(--color-forge-text-muted)] font-medium">Intermediate</th>
                        <th className="pb-2 text-center text-[var(--color-forge-text-muted)] font-medium">Advanced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ENGAGEMENT_BENCHMARKS.map((row) => (
                        <tr key={row.metric} className="border-b border-[var(--color-forge-border-default)]">
                          <td className="py-2 text-[var(--color-forge-text-primary)]">{row.metric}</td>
                          <td className="py-2 text-center text-[var(--color-forge-text-muted)]">{row.beginner}</td>
                          <td className="py-2 text-center text-[var(--color-forge-warning)]">{row.intermediate}</td>
                          <td className="py-2 text-center text-[var(--color-forge-success)]">{row.advanced}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <LinkedInPostComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
      <OutreachGenerator
        open={outreachOpen}
        onClose={() => { setOutreachOpen(false); setOutreachTarget(null); }}
        recipientName={outreachTarget?.name}
        recipientTitle={outreachTarget?.title}
        recipientCompany={outreachTarget?.company}
      />
    </div>
  );
}
