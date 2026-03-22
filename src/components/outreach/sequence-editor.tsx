"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { OutreachStep } from "@/types";

interface SequenceEditorProps {
  steps: OutreachStep[];
  onStepChange: (stepId: string, messageTemplate: string) => void;
}

const channelColors: Record<string, string> = {
  linkedin: "border-[#0077b5]",
  twitter: "border-[#1d9bf0]",
  email: "border-[var(--color-forge-info)]",
  reddit: "border-[#ff4500]",
};

export function SequenceEditor({ steps, onStepChange }: SequenceEditorProps) {
  return (
    <div className="relative space-y-0">
      {/* Vertical timeline line */}
      <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-[var(--color-forge-border-default)]" />

      {steps.map((step, index) => (
        <div key={step.id} className="relative flex gap-4 pb-4">
          {/* Timeline dot */}
          <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--color-forge-bg-card)] border-[var(--color-forge-accent)]">
            <span className="text-xs font-bold text-[var(--color-forge-accent)]">{index + 1}</span>
          </div>

          {/* Step Card */}
          <Card className={`flex-1 border-l-2 ${channelColors[step.channel] || "border-[var(--color-forge-border-default)]"} border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-[var(--color-forge-border-default)] text-[var(--color-forge-text-muted)]">
                    Day {step.day}
                  </Badge>
                  <Badge className="text-[10px] bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)]">
                    {step.channel}
                  </Badge>
                </div>
                {step.waitDays > 0 && (
                  <span className="text-[10px] text-[var(--color-forge-text-muted)]">
                    Wait {step.waitDays}d before next
                  </span>
                )}
              </div>

              <p className="text-xs font-medium text-[var(--color-forge-text-primary)]">{step.action}</p>

              <Textarea
                value={step.messageTemplate}
                onChange={(e) => onStepChange(step.id, e.target.value)}
                rows={3}
                className="text-xs resize-y border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
              />

              {/* Highlight template variables */}
              {step.messageTemplate.match(/\{[^}]+\}/g) && (
                <div className="flex flex-wrap gap-1">
                  {Array.from(new Set(step.messageTemplate.match(/\{[^}]+\}/g) || [])).map((variable) => (
                    <Badge key={variable} variant="outline" className="text-[9px] border-[var(--color-forge-warning)] text-[var(--color-forge-warning)]">
                      {variable}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
