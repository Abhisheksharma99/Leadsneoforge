"use client";

import { useState, useCallback } from "react";
import {
  Megaphone,
  Plus,
  Calendar,
  Target,
  BarChart3,
  Loader2,
  Trash2,
  Play,
  Pause,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Globe,
  MessageSquare,
  Mail,
  Twitter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStatus = "draft" | "active" | "paused" | "completed";
type ChannelType = "reddit" | "twitter" | "linkedin" | "email" | "blog" | "seo";

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  channels: ChannelType[];
  startDate: string;
  endDate?: string;
  budget?: string;
  kpis: {
    impressions: number;
    clicks: number;
    conversions: number;
    engagement: number;
  };
  tasks: CampaignTask[];
  createdAt: string;
}

interface CampaignTask {
  id: string;
  title: string;
  channel: ChannelType;
  status: "pending" | "in_progress" | "done";
  dueDate?: string;
}

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNELS: { value: ChannelType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "reddit", label: "Reddit", icon: MessageSquare },
  { value: "twitter", label: "Twitter/X", icon: Twitter },
  { value: "linkedin", label: "LinkedIn", icon: Globe },
  { value: "email", label: "Email", icon: Mail },
  { value: "blog", label: "Blog/Content", icon: Globe },
  { value: "seo", label: "SEO", icon: BarChart3 },
];

const statusColors: Record<CampaignStatus, string> = {
  draft: "bg-[rgba(107,107,103,0.15)] text-[var(--color-forge-text-muted)]",
  active: "bg-[rgba(52,211,153,0.15)] text-[var(--color-forge-success)]",
  paused: "bg-[rgba(251,191,36,0.15)] text-[var(--color-forge-warning)]",
  completed: "bg-[rgba(96,165,250,0.15)] text-[var(--color-forge-info)]",
};

const statusIcons: Record<CampaignStatus, React.ReactNode> = {
  draft: <Clock className="h-3 w-3" />,
  active: <Play className="h-3 w-3" />,
  paused: <Pause className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
};

// ─── Campaign Templates ─────────────────────────────────────────────────────

const CAMPAIGN_TEMPLATES = [
  {
    name: "Product Launch",
    description: "Full-stack product launch campaign across all channels",
    channels: ["reddit", "twitter", "linkedin", "email", "blog"] as ChannelType[],
    tasks: [
      { title: "Write launch blog post", channel: "blog" as ChannelType },
      { title: "Create Twitter thread", channel: "twitter" as ChannelType },
      { title: "Design LinkedIn carousel", channel: "linkedin" as ChannelType },
      { title: "Draft launch email", channel: "email" as ChannelType },
      { title: "Post in relevant subreddits", channel: "reddit" as ChannelType },
      { title: "Monitor mentions & engagement", channel: "reddit" as ChannelType },
    ],
  },
  {
    name: "Community Engagement",
    description: "Build brand presence in online communities",
    channels: ["reddit", "twitter"] as ChannelType[],
    tasks: [
      { title: "Identify target subreddits", channel: "reddit" as ChannelType },
      { title: "Create value-first content plan", channel: "reddit" as ChannelType },
      { title: "Engage in discussions daily", channel: "reddit" as ChannelType },
      { title: "Run Twitter polls", channel: "twitter" as ChannelType },
      { title: "Respond to industry threads", channel: "twitter" as ChannelType },
    ],
  },
  {
    name: "SEO Content Sprint",
    description: "Publish 10 SEO-optimized articles in 2 weeks",
    channels: ["blog", "seo", "twitter"] as ChannelType[],
    tasks: [
      { title: "Keyword research & topic clustering", channel: "seo" as ChannelType },
      { title: "Write 10 blog articles", channel: "blog" as ChannelType },
      { title: "Internal linking optimization", channel: "seo" as ChannelType },
      { title: "Promote articles on Twitter", channel: "twitter" as ChannelType },
      { title: "Track rankings after 2 weeks", channel: "seo" as ChannelType },
    ],
  },
  {
    name: "Lead Generation",
    description: "Drive qualified leads through multi-channel outreach",
    channels: ["linkedin", "email", "blog"] as ChannelType[],
    tasks: [
      { title: "Build prospect list", channel: "linkedin" as ChannelType },
      { title: "Create lead magnet", channel: "blog" as ChannelType },
      { title: "Design email drip sequence", channel: "email" as ChannelType },
      { title: "LinkedIn outreach campaign", channel: "linkedin" as ChannelType },
      { title: "A/B test email subject lines", channel: "email" as ChannelType },
    ],
  },
];

// ─── Page Component ───────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // New campaign form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newChannels, setNewChannels] = useState<ChannelType[]>([]);
  const [newStartDate, setNewStartDate] = useState("");
  const [newBudget, setNewBudget] = useState("");

  const createCampaign = useCallback(
    (template?: (typeof CAMPAIGN_TEMPLATES)[0]) => {
      const campaign: Campaign = {
        id: crypto.randomUUID(),
        name: template?.name || newName || "New Campaign",
        description: template?.description || newDescription || "",
        status: "draft",
        channels: template?.channels || newChannels,
        startDate: newStartDate || new Date().toISOString().split("T")[0],
        budget: newBudget || undefined,
        kpis: { impressions: 0, clicks: 0, conversions: 0, engagement: 0 },
        tasks: (template?.tasks || []).map((t) => ({
          id: crypto.randomUUID(),
          title: t.title,
          channel: t.channel,
          status: "pending" as const,
        })),
        createdAt: new Date().toISOString(),
      };

      setCampaigns((prev) => [campaign, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewChannels([]);
      setNewStartDate("");
      setNewBudget("");
      toast.success(`Campaign "${campaign.name}" created`);
    },
    [newName, newDescription, newChannels, newStartDate, newBudget]
  );

  const updateCampaignStatus = useCallback(
    (id: string, status: CampaignStatus) => {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c))
      );
    },
    []
  );

  const updateTaskStatus = useCallback(
    (campaignId: string, taskId: string, status: CampaignTask["status"]) => {
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                tasks: c.tasks.map((t) =>
                  t.id === taskId ? { ...t, status } : t
                ),
              }
            : c
        )
      );
    },
    []
  );

  const deleteCampaign = useCallback((id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    setSelectedCampaign(null);
    toast.success("Campaign deleted");
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-[var(--color-forge-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
            Plan, execute, and track multi-channel marketing campaigns
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Templates */}
      {showCreate && (
        <Card className="border-[var(--color-forge-accent)] border-opacity-30 bg-[var(--color-forge-bg-card)]">
          <CardHeader>
            <CardTitle className="text-[var(--color-forge-text-primary)]">
              Create Campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quick Templates */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[var(--color-forge-text-secondary)]">
                Quick Start Templates
              </Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CAMPAIGN_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => createCampaign(t)}
                    className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-3 text-left transition-colors hover:border-[var(--color-forge-accent)] hover:bg-[var(--color-forge-accent-muted)]"
                  >
                    <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">
                      {t.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-forge-text-muted)]">
                      {t.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.channels.map((ch) => (
                        <Badge
                          key={ch}
                          variant="outline"
                          className="text-[9px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                        >
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator className="bg-[var(--color-forge-border-default)]" />

            {/* Custom Campaign */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm text-[var(--color-forge-text-secondary)]">Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Campaign name..."
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-[var(--color-forge-text-secondary)]">Start Date</Label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm text-[var(--color-forge-text-secondary)]">Description</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What's this campaign about?"
                  rows={2}
                  className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm text-[var(--color-forge-text-secondary)]">Channels</Label>
                <div className="flex flex-wrap gap-3">
                  {CHANNELS.map((ch) => (
                    <div key={ch.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`ch-${ch.value}`}
                        checked={newChannels.includes(ch.value)}
                        onCheckedChange={(checked) =>
                          setNewChannels((prev) =>
                            checked
                              ? [...prev, ch.value]
                              : prev.filter((c) => c !== ch.value)
                          )
                        }
                      />
                      <Label htmlFor={`ch-${ch.value}`} className="cursor-pointer text-sm text-[var(--color-forge-text-primary)]">
                        {ch.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Button
              onClick={() => createCampaign()}
              disabled={!newName.trim()}
              className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Campaign
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Campaign List */}
      {campaigns.length === 0 && !showCreate ? (
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <Megaphone className="h-10 w-10 mx-auto text-[var(--color-forge-accent)] opacity-40" />
              <p className="text-sm text-[var(--color-forge-text-muted)]">
                No campaigns yet. Create your first campaign to start tracking marketing efforts.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                variant="outline"
                className="border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Campaign Cards */}
          <div className={`space-y-4 ${selectedCampaign ? "lg:col-span-1" : "lg:col-span-3"}`}>
            <div className={`grid gap-4 ${selectedCampaign ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
              {campaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className={`cursor-pointer border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] transition-colors hover:bg-[var(--color-forge-bg-card-hover)] ${
                    selectedCampaign?.id === campaign.id ? "border-[var(--color-forge-accent)]" : ""
                  }`}
                >
                  <CardContent className="pt-5">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-semibold text-[var(--color-forge-text-primary)]">
                          {campaign.name}
                        </h3>
                        <Badge className={statusColors[campaign.status]}>
                          {statusIcons[campaign.status]}
                          <span className="ml-1">{campaign.status}</span>
                        </Badge>
                      </div>
                      {campaign.description && (
                        <p className="text-xs text-[var(--color-forge-text-muted)] line-clamp-2">
                          {campaign.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {campaign.channels.map((ch) => (
                          <Badge
                            key={ch}
                            variant="outline"
                            className="text-[9px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                          >
                            {ch}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--color-forge-text-muted)]">
                        <span>
                          {campaign.tasks.filter((t) => t.status === "done").length}/
                          {campaign.tasks.length} tasks done
                        </span>
                        <span>{campaign.startDate}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full rounded-full bg-[var(--color-forge-bg-elevated)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-forge-accent)] transition-all"
                          style={{
                            width: `${campaign.tasks.length > 0 ? (campaign.tasks.filter((t) => t.status === "done").length / campaign.tasks.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Campaign Detail */}
          {selectedCampaign && (
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-[var(--color-forge-text-primary)]">
                        {selectedCampaign.name}
                      </CardTitle>
                      <p className="mt-1 text-xs text-[var(--color-forge-text-muted)]">
                        {selectedCampaign.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedCampaign.status}
                        onValueChange={(v) => {
                          updateCampaignStatus(selectedCampaign.id, v as CampaignStatus);
                          setSelectedCampaign({ ...selectedCampaign, status: v as CampaignStatus });
                        }}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCampaign(selectedCampaign.id)}
                        className="h-8 text-[var(--color-forge-error)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* KPIs */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Impressions", value: selectedCampaign.kpis.impressions, icon: Target },
                      { label: "Clicks", value: selectedCampaign.kpis.clicks, icon: BarChart3 },
                      { label: "Conversions", value: selectedCampaign.kpis.conversions, icon: CheckCircle2 },
                      { label: "Engagement", value: selectedCampaign.kpis.engagement, icon: MessageSquare },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-3 text-center"
                      >
                        <kpi.icon className="h-4 w-4 mx-auto mb-1 text-[var(--color-forge-text-muted)]" />
                        <p className="text-lg font-semibold text-[var(--color-forge-text-primary)]">
                          {kpi.value}
                        </p>
                        <p className="text-[10px] text-[var(--color-forge-text-muted)]">{kpi.label}</p>
                      </div>
                    ))}
                  </div>

                  <Separator className="bg-[var(--color-forge-border-default)]" />

                  {/* Tasks */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-[var(--color-forge-text-secondary)]">
                      Tasks
                    </h4>
                    {selectedCampaign.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2"
                      >
                        <Checkbox
                          checked={task.status === "done"}
                          onCheckedChange={(checked) => {
                            const newStatus = checked ? "done" : "pending";
                            updateTaskStatus(selectedCampaign.id, task.id, newStatus);
                            setSelectedCampaign({
                              ...selectedCampaign,
                              tasks: selectedCampaign.tasks.map((t) =>
                                t.id === task.id ? { ...t, status: newStatus } : t
                              ),
                            });
                          }}
                        />
                        <span
                          className={`flex-1 text-sm ${
                            task.status === "done"
                              ? "text-[var(--color-forge-text-muted)] line-through"
                              : "text-[var(--color-forge-text-primary)]"
                          }`}
                        >
                          {task.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]"
                        >
                          {task.channel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
