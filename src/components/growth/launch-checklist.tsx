"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LaunchChecklistItem, LaunchChecklistPhase } from "@/types";

interface LaunchChecklistProps {
  items: LaunchChecklistItem[];
  onToggle: (id: string) => void;
}

const phaseLabels: Record<LaunchChecklistPhase, string> = {
  pre_launch: "Pre-Launch",
  launch_day: "Launch Day",
  post_launch: "Post-Launch",
};

const phaseColors: Record<LaunchChecklistPhase, string> = {
  pre_launch: "var(--color-forge-warning)",
  launch_day: "var(--color-forge-accent)",
  post_launch: "var(--color-forge-success)",
};

export function LaunchChecklist({ items, onToggle }: LaunchChecklistProps) {
  const phases: LaunchChecklistPhase[] = ["pre_launch", "launch_day", "post_launch"];

  return (
    <div className="space-y-4">
      {phases.map((phase) => {
        const phaseItems = items.filter((i) => i.phase === phase);
        if (phaseItems.length === 0) return null;
        const completedCount = phaseItems.filter((i) => i.completed).length;
        const progress = (completedCount / phaseItems.length) * 100;

        return (
          <Card key={phase} className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-[var(--color-forge-text-primary)]">
                  {phaseLabels[phase]}
                </CardTitle>
                <span className="text-[10px] text-[var(--color-forge-text-muted)]">
                  {completedCount}/{phaseItems.length} completed
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-[var(--color-forge-bg-elevated)] mt-2">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: phaseColors[phase],
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {phaseItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2 cursor-pointer hover:border-[var(--color-forge-accent)]"
                  onClick={() => onToggle(item.id)}
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => onToggle(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.completed ? "line-through text-[var(--color-forge-text-muted)]" : "text-[var(--color-forge-text-primary)]"}`}>
                      {item.task}
                    </p>
                    <p className="text-[10px] text-[var(--color-forge-text-muted)] mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
