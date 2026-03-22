"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadStatus } from "@/types";

interface LeadCardProps {
  lead: Lead;
  onStatusChange: (id: string, status: LeadStatus) => void;
}

const statusColors: Record<LeadStatus, string> = {
  new: "bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-info)]",
  contacted: "bg-[rgba(251,191,36,0.15)] text-[var(--color-forge-warning)]",
  replied: "bg-[rgba(52,211,153,0.15)] text-[var(--color-forge-success)]",
  qualified: "bg-[rgba(167,139,250,0.15)] text-[var(--color-forge-secondary)]",
  converted: "bg-[rgba(52,211,153,0.25)] text-[var(--color-forge-success)]",
  lost: "bg-[rgba(239,68,68,0.15)] text-[var(--color-forge-error)]",
};

const platformColors: Record<string, string> = {
  linkedin: "bg-[rgba(0,119,181,0.15)] text-[#0077b5]",
  twitter: "bg-[rgba(29,155,240,0.15)] text-[#1d9bf0]",
  reddit: "bg-[rgba(255,69,0,0.15)] text-[#ff4500]",
  email: "bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-info)]",
  producthunt: "bg-[rgba(218,85,47,0.15)] text-[#da552f]",
  hackernews: "bg-[rgba(255,102,0,0.15)] text-[#ff6600]",
};

export function LeadCard({ lead, onStatusChange }: LeadCardProps) {
  return (
    <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">{lead.name}</p>
            <p className="text-xs text-[var(--color-forge-text-muted)]">{lead.title}</p>
            <p className="text-xs text-[var(--color-forge-text-muted)]">{lead.company}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={`text-[10px] ${platformColors[lead.platform] || ""}`}>
              {lead.platform}
            </Badge>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{
                backgroundColor: lead.score >= 80 ? "var(--color-forge-success)" : lead.score >= 50 ? "var(--color-forge-warning)" : "var(--color-forge-text-muted)",
              }} />
              <span className="text-[10px] text-[var(--color-forge-text-muted)]">{lead.score}/100</span>
            </div>
          </div>
        </div>

        {lead.notes && (
          <p className="text-xs text-[var(--color-forge-text-muted)] line-clamp-2">{lead.notes}</p>
        )}

        <div className="flex items-center justify-between">
          <Select value={lead.status} onValueChange={(v) => onStatusChange(lead.id, v as LeadStatus)}>
            <SelectTrigger className="h-7 w-32 text-[10px] border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Badge className={`text-[10px] ${statusColors[lead.status]}`}>
            {lead.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
