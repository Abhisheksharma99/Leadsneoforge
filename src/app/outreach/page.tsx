"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Users,
  GitBranch,
  FileText,
  BarChart3,
  Plus,
  Filter,
  Loader2,
  Wand2,
  RefreshCw,
  Copy,
  Target,
  Mail,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LeadCard } from "@/components/outreach/lead-card";
import { SequenceEditor } from "@/components/outreach/sequence-editor";
import { useLeads, useAddLead, useUpdateLead } from "@/hooks/use-leads";
import type { Lead, LeadStatus, LeadPlatform, OutreachStep, OutreachTemplate, OutreachTemplateCategory } from "@/types";

// ─── Templates (starter templates, not fake data) ───────────────────────────

const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  { id: "1", name: "Cold LinkedIn Connect", category: "cold_outreach", platform: "linkedin", body: "Hi {name}, I noticed your work at {company} on {topic}. I'm building tools in the same space and would love to connect and share insights.", variables: ["name", "company", "topic"] },
  { id: "2", name: "Twitter DM Intro", category: "cold_outreach", platform: "twitter", body: "Hey {name}! Loved your thread about {topic}. We're working on something similar at {company}. Would love to chat if you're open to it.", variables: ["name", "topic", "company"] },
  { id: "3", name: "Cold Email", category: "cold_outreach", platform: "email", subject: "Quick question about {company}", body: "Hi {name},\n\nI saw {company} is working on {topic}. We've helped similar companies save 10+ hours/week on this.\n\nWorth a 15-min chat?\n\nBest,\n[Your name]", variables: ["name", "company", "topic"] },
  { id: "4", name: "Reddit DM", category: "cold_outreach", platform: "reddit", body: "Hey {name}, saw your post about {topic} in r/{subreddit}. Really insightful. I've been working on something related and thought you might find it useful. Happy to share more if interested.", variables: ["name", "topic", "subreddit"] },
  { id: "5", name: "LinkedIn Follow-up", category: "follow_up", platform: "linkedin", body: "Hi {name}, following up on my earlier message. I came across this article about {topic} and thought of you. Would love to connect when you have a moment.", variables: ["name", "topic"] },
  { id: "6", name: "Email Follow-up #1", category: "follow_up", platform: "email", subject: "Re: Quick question", body: "Hi {name},\n\nJust bumping this up. I also wanted to share this case study about how {similar_company} tackled {topic} — thought it might be relevant.\n\nBest,\n[Your name]", variables: ["name", "similar_company", "topic"] },
  { id: "7", name: "Post-Call Follow-up", category: "follow_up", platform: "email", subject: "Great chatting, {name}!", body: "Hi {name},\n\nThanks for the call! As discussed:\n\n1. {action_item_1}\n2. {action_item_2}\n\nI'll send over the {deliverable} by {date}.\n\nBest,\n[Your name]", variables: ["name", "action_item_1", "action_item_2", "deliverable", "date"] },
  { id: "8", name: "Referral Request", category: "referral", platform: "linkedin", body: "Hi {name}, I've really enjoyed our conversations. I'm looking to connect with more {role}s in the {industry} space. Would you know anyone who might benefit from {value_prop}?", variables: ["name", "role", "industry", "value_prop"] },
  { id: "9", name: "Mutual Intro Request", category: "referral", platform: "email", subject: "Quick intro request", body: "Hi {name},\n\nI noticed you're connected with {target_name} at {target_company}. I think {reason}. Would you be open to making a quick intro?\n\nHappy to reciprocate anytime!\n\nBest,\n[Your name]", variables: ["name", "target_name", "target_company", "reason"] },
  { id: "10", name: "Partnership Proposal", category: "partnership", platform: "linkedin", body: "Hi {name}, I've been following {company}'s work on {topic}. I think there's a great opportunity for us to collaborate — our {product} complements what you're building. Would you be open to exploring this?", variables: ["name", "company", "topic", "product"] },
  { id: "11", name: "Co-Marketing Pitch", category: "partnership", platform: "email", subject: "Co-marketing opportunity", body: "Hi {name},\n\nI'm reaching out because our audiences overlap significantly. I'd love to explore a co-marketing opportunity — whether it's a joint webinar, guest post exchange, or something else.\n\nOur audience: {audience_size} {audience_type}.\n\nInterested?\n\nBest,\n[Your name]", variables: ["name", "audience_size", "audience_type"] },
  { id: "12", name: "Integration Partnership", category: "partnership", platform: "email", subject: "{company} x [Your Company] integration", body: "Hi {name},\n\nOur users keep asking about a {company} integration. I think it would be mutually beneficial — your users get {benefit_to_them}, our users get {benefit_to_us}.\n\nWorth discussing?\n\nBest,\n[Your name]", variables: ["name", "company", "benefit_to_them", "benefit_to_us"] },
];

// ─── Platform color map for analytics ────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "#0077b5",
  email: "var(--color-forge-info)",
  twitter: "#1d9bf0",
  reddit: "#ff4500",
  producthunt: "#da552f",
  hackernews: "#ff6600",
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  // Lead Board state — API-backed
  const { data: leads = [], isLoading } = useLeads();
  const addLeadMutation = useAddLead();
  const updateLeadMutation = useUpdateLead();

  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", title: "", company: "", platform: "linkedin" as LeadPlatform, notes: "" });

  // Sequence state
  const [sequencePlatform, setSequencePlatform] = useState("linkedin");
  const [sequenceGoal, setSequenceGoal] = useState("");
  const [sequenceSteps, setSequenceSteps] = useState<OutreachStep[]>([]);
  const [sequenceName, setSequenceName] = useState("");
  const [isGeneratingSequence, setIsGeneratingSequence] = useState(false);

  // Template filter
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [templatePlatform, setTemplatePlatform] = useState<string>("all");

  const updateLeadStatus = useCallback((id: string, status: LeadStatus) => {
    updateLeadMutation.mutate(
      { id, status },
      {
        onSuccess: () => toast.success("Lead status updated"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update lead"),
      }
    );
  }, [updateLeadMutation]);

  const addLead = useCallback(() => {
    if (!newLead.name || !newLead.company) {
      toast.error("Name and company are required");
      return;
    }
    addLeadMutation.mutate(
      {
        ...newLead,
        status: "new" as LeadStatus,
        score: Math.floor(Math.random() * 30) + 60,
      },
      {
        onSuccess: () => {
          setNewLead({ name: "", title: "", company: "", platform: "linkedin", notes: "" });
          setShowAddLead(false);
          toast.success("Lead added");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add lead"),
      }
    );
  }, [newLead, addLeadMutation]);

  const generateSequence = useCallback(async () => {
    if (!sequenceGoal) {
      toast.error("Enter a sequence goal");
      return;
    }
    setIsGeneratingSequence(true);
    try {
      const response = await fetch("/api/outreach/generate-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: sequencePlatform, goal: sequenceGoal, steps: 5 }),
      });
      if (!response.ok) throw new Error("Generation failed");
      const result = await response.json();
      const steps = (result.data.steps || []).map((s: OutreachStep, i: number) => ({ ...s, id: String(i + 1) }));
      setSequenceSteps(steps);
      setSequenceName(result.data.name || "Custom Sequence");
      toast.success("Sequence generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate sequence");
    } finally {
      setIsGeneratingSequence(false);
    }
  }, [sequencePlatform, sequenceGoal]);

  const updateSequenceStep = useCallback((stepId: string, messageTemplate: string) => {
    setSequenceSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, messageTemplate } : s));
  }, []);

  // KPIs — computed from actual lead data
  const kpis = useMemo(() => ({
    total: leads.length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    replied: leads.filter((l) => l.status === "replied").length,
    qualified: leads.filter((l) => l.status === "qualified").length,
    converted: leads.filter((l) => l.status === "converted").length,
  }), [leads]);

  // Filtered leads
  const filteredLeads = useMemo(() => leads.filter((l) => {
    if (filterPlatform !== "all" && l.platform !== filterPlatform) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    return true;
  }), [leads, filterPlatform, filterStatus]);

  // Filtered templates
  const filteredTemplates = OUTREACH_TEMPLATES.filter((t) => {
    if (templateCategory !== "all" && t.category !== templateCategory) return false;
    if (templatePlatform !== "all" && t.platform !== templatePlatform) return false;
    return true;
  });

  // ─── Analytics computed from actual leads ──────────────────────────────────

  const analytics = useMemo(() => {
    const total = leads.length;

    // Funnel stages: each stage includes leads at that stage AND all later stages
    // new -> contacted -> replied -> qualified -> converted
    const convertedCount = leads.filter((l) => l.status === "converted").length;
    const qualifiedCount = leads.filter((l) => l.status === "qualified").length + convertedCount;
    const repliedCount = leads.filter((l) => l.status === "replied").length + qualifiedCount;
    const contactedCount = leads.filter((l) => l.status === "contacted").length + repliedCount;

    const funnel = [
      { stage: "Total Leads", count: total, pct: 100, color: "var(--color-forge-text-primary)" },
      { stage: "Contacted", count: contactedCount, pct: total > 0 ? Math.round((contactedCount / total) * 100) : 0, color: "var(--color-forge-warning)" },
      { stage: "Replied", count: repliedCount, pct: total > 0 ? Math.round((repliedCount / total) * 100) : 0, color: "var(--color-forge-info)" },
      { stage: "Qualified", count: qualifiedCount, pct: total > 0 ? Math.round((qualifiedCount / total) * 100) : 0, color: "var(--color-forge-secondary)" },
      { stage: "Converted", count: convertedCount, pct: total > 0 ? Math.round((convertedCount / total) * 100) : 0, color: "var(--color-forge-success)" },
    ];

    // Platform breakdown
    const platformCounts: Record<string, number> = {};
    for (const lead of leads) {
      platformCounts[lead.platform] = (platformCounts[lead.platform] || 0) + 1;
    }
    const platformBreakdown = Object.entries(platformCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([platform, count]) => ({
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        platformKey: platform,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
        color: PLATFORM_COLORS[platform] || "var(--color-forge-text-muted)",
      }));

    // Response rates per platform — percentage of leads on each platform that have progressed past "new"
    const platformResponseRates = Object.entries(platformCounts).map(([platform, count]) => {
      const responded = leads.filter(
        (l) => l.platform === platform && l.status !== "new" && l.status !== "contacted"
      ).length;
      const rate = count > 0 ? Math.round((responded / count) * 100) : 0;
      return {
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        rate: `${rate}%`,
        responded,
        total: count,
      };
    }).sort((a, b) => parseInt(b.rate) - parseInt(a.rate));

    return { funnel, platformBreakdown, platformResponseRates };
  }, [leads]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-forge-text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
          Outreach Hub
        </h1>
        <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
          Manage leads, build outreach sequences, and track conversions across all platforms
        </p>
      </div>

      <Tabs defaultValue="leads" className="space-y-6">
        <TabsList className="bg-[var(--color-forge-bg-elevated)] border border-[var(--color-forge-border-default)]">
          <TabsTrigger value="leads" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Lead Board
          </TabsTrigger>
          <TabsTrigger value="sequences" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            Sequences
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Lead Board Tab */}
        <TabsContent value="leads">
          <div className="space-y-4">
            {/* KPI Row */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "Total Leads", value: kpis.total, color: "var(--color-forge-text-primary)" },
                { label: "Contacted", value: kpis.contacted, color: "var(--color-forge-warning)" },
                { label: "Replied", value: kpis.replied, color: "var(--color-forge-info)" },
                { label: "Qualified", value: kpis.qualified, color: "var(--color-forge-secondary)" },
                { label: "Converted", value: kpis.converted, color: "var(--color-forge-success)" },
              ].map((kpi) => (
                <Card key={kpi.label} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                    <p className="text-[10px] text-[var(--color-forge-text-muted)]">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters + Add */}
            <div className="flex items-center gap-3">
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="h-8 w-36 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="producthunt">Product Hunt</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-36 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setShowAddLead(!showAddLead)} className="ml-auto h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]">
                <Plus className="h-3 w-3 mr-1" />Add Lead
              </Button>
            </div>

            {/* Add Lead Form */}
            {showAddLead && (
              <Card className="border-[var(--color-forge-accent)] bg-[var(--color-forge-bg-card)]">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    <Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} placeholder="Name *" className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                    <Input value={newLead.title} onChange={(e) => setNewLead({ ...newLead, title: e.target.value })} placeholder="Title" className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                    <Input value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} placeholder="Company *" className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                    <Select value={newLead.platform} onValueChange={(v) => setNewLead({ ...newLead, platform: v as LeadPlatform })}>
                      <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="twitter">Twitter</SelectItem>
                        <SelectItem value="reddit">Reddit</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Notes" className="h-8 text-xs flex-1 border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
                    <Button size="sm" onClick={addLead} disabled={addLeadMutation.isPending} className="h-8 bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]">
                      {addLeadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading state */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-forge-accent)]" />
                <span className="ml-3 text-sm text-[var(--color-forge-text-muted)]">Loading leads...</span>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-[var(--color-forge-text-muted)] mb-3" />
                <p className="text-sm text-[var(--color-forge-text-muted)]">No leads found. Add your first lead to get started.</p>
              </div>
            ) : (
              /* Lead Cards */
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onStatusChange={updateLeadStatus} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sequences Tab */}
        <TabsContent value="sequences">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Generate AI-powered multi-step outreach sequences or use pre-built templates.
            </p>

            {/* Pre-built templates */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { name: "LinkedIn 5-Step", platform: "linkedin", steps: 5, icon: Target },
                { name: "Twitter DM 3-Step", platform: "twitter", steps: 3, icon: MessageSquare },
                { name: "Email 7-Step", platform: "email", steps: 7, icon: Mail },
                { name: "Reddit 4-Step", platform: "reddit", steps: 4, icon: Users },
              ].map((template) => (
                <Card
                  key={template.name}
                  className="cursor-pointer border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] hover:border-[var(--color-forge-accent)] transition-colors"
                  onClick={() => {
                    setSequencePlatform(template.platform);
                    setSequenceGoal(`Generate leads via ${template.platform}`);
                    generateSequence();
                  }}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-forge-accent-muted)]">
                      <template.icon className="h-5 w-5 text-[var(--color-forge-accent)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">{template.name}</p>
                      <p className="text-[10px] text-[var(--color-forge-text-muted)]">{template.steps} steps</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Custom Sequence Generator */}
            <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Custom Sequence Generator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Select value={sequencePlatform} onValueChange={setSequencePlatform}>
                    <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="reddit">Reddit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={sequenceGoal}
                    onChange={(e) => setSequenceGoal(e.target.value)}
                    placeholder="Goal (e.g., Book demo calls with CTOs)"
                    className="col-span-2 h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                  />
                </div>
                <Button onClick={generateSequence} disabled={isGeneratingSequence || !sequenceGoal} className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]">
                  {isGeneratingSequence ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : sequenceSteps.length > 0 ? <><RefreshCw className="mr-2 h-4 w-4" />Regenerate</> : <><Wand2 className="mr-2 h-4 w-4" />Generate Sequence</>}
                </Button>
              </CardContent>
            </Card>

            {/* Sequence Editor */}
            {sequenceSteps.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-[var(--color-forge-text-primary)]">{sequenceName}</h3>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(sequenceSteps, null, 2)); toast.success("Sequence copied as JSON"); }} className="h-7 text-xs border-[var(--color-forge-border-default)]">
                    <Copy className="h-3 w-3 mr-1" />Export
                  </Button>
                </div>
                <SequenceEditor steps={sequenceSteps} onStepChange={updateSequenceStep} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger className="h-8 w-40 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                </SelectContent>
              </Select>
              <Select value={templatePlatform} onValueChange={setTemplatePlatform}>
                <SelectTrigger className="h-8 w-36 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]"><SelectValue placeholder="Platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-[var(--color-forge-text-muted)] ml-auto">{filteredTemplates.length} templates</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">{template.name}</p>
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]">{template.platform}</Badge>
                        <Badge className="text-[10px] bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)]">{template.category.replace("_", " ")}</Badge>
                      </div>
                    </div>
                    {template.subject && (
                      <p className="text-xs text-[var(--color-forge-text-muted)]">Subject: {template.subject}</p>
                    )}
                    <div className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-2">
                      <p className="text-xs text-[var(--color-forge-text-secondary)] whitespace-pre-wrap">{template.body}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((v) => (
                          <Badge key={v} variant="outline" className="text-[9px] border-[var(--color-forge-warning)] text-[var(--color-forge-warning)]">
                            {`{${v}}`}
                          </Badge>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => { navigator.clipboard.writeText(template.body); toast.success("Template copied"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-forge-text-secondary)]">
              Analytics are computed from your actual lead data.
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-forge-accent)]" />
                <span className="ml-3 text-sm text-[var(--color-forge-text-muted)]">Loading analytics...</span>
              </div>
            ) : leads.length === 0 ? (
              <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardContent className="p-8 text-center">
                  <BarChart3 className="h-10 w-10 text-[var(--color-forge-text-muted)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-forge-text-muted)]">No lead data yet. Add leads to see analytics here.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Funnel */}
                <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Outreach Funnel</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analytics.funnel.map((stage) => (
                      <div key={stage.stage} className="flex items-center gap-3">
                        <div className="w-28 text-xs text-[var(--color-forge-text-secondary)]">{stage.stage}</div>
                        <div className="flex-1">
                          <div className="h-6 rounded bg-[var(--color-forge-bg-elevated)]">
                            <div className="h-full rounded flex items-center px-2" style={{ width: `${Math.max(stage.pct, 2)}%`, backgroundColor: stage.color, opacity: 0.2 }}>
                              <span className="text-[10px] font-medium" style={{ color: stage.color }}>{stage.count}</span>
                            </div>
                          </div>
                        </div>
                        <span className="w-12 text-xs text-right text-[var(--color-forge-text-muted)]">{stage.pct}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Platform Breakdown + Response Rates */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Platform Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {analytics.platformBreakdown.length > 0 ? (
                        analytics.platformBreakdown.map((p) => (
                          <div key={p.platformKey} className="flex items-center gap-3">
                            <div className="w-24 text-xs text-[var(--color-forge-text-secondary)]">{p.platform}</div>
                            <div className="flex-1">
                              <div className="h-3 rounded-full bg-[var(--color-forge-bg-elevated)]">
                                <div className="h-full rounded-full" style={{ width: `${Math.max(p.pct, 3)}%`, backgroundColor: p.color }} />
                              </div>
                            </div>
                            <span className="text-xs text-[var(--color-forge-text-muted)]">{p.count} ({p.pct}%)</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[var(--color-forge-text-muted)]">No platform data yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Response Rates by Platform</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {analytics.platformResponseRates.length > 0 ? (
                        analytics.platformResponseRates.map((p) => (
                          <div key={p.platform} className="flex items-center justify-between rounded border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2">
                            <span className="text-xs text-[var(--color-forge-text-primary)]">{p.platform}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[var(--color-forge-accent)]">{p.rate}</span>
                              <span className="text-[10px] text-[var(--color-forge-text-muted)]">{p.responded}/{p.total} responded</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[var(--color-forge-text-muted)]">No response data yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Best Templates — placeholder for CRM integration */}
                <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">Best Performing Templates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="h-8 w-8 text-[var(--color-forge-text-muted)] mb-2" />
                      <p className="text-sm text-[var(--color-forge-text-muted)]">Connect your CRM for template analytics</p>
                      <p className="text-xs text-[var(--color-forge-text-muted)] mt-1">Track which templates drive the highest response and conversion rates.</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
