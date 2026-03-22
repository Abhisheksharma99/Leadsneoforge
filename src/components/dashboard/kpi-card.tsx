"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: "accent" | "secondary" | "success" | "error" | "warning" | "info";
  loading?: boolean;
}

const colorMap: Record<string, { bg: string; text: string }> = {
  accent: {
    bg: "bg-[var(--color-forge-accent-muted)]",
    text: "text-[var(--color-forge-accent)]",
  },
  secondary: {
    bg: "bg-[rgba(129,140,248,0.15)]",
    text: "text-[var(--color-forge-secondary)]",
  },
  success: {
    bg: "bg-[rgba(52,211,153,0.15)]",
    text: "text-[var(--color-forge-success)]",
  },
  error: {
    bg: "bg-[rgba(248,113,113,0.15)]",
    text: "text-[var(--color-forge-error)]",
  },
  warning: {
    bg: "bg-[rgba(251,191,36,0.15)]",
    text: "text-[var(--color-forge-warning)]",
  },
  info: {
    bg: "bg-[rgba(96,165,250,0.15)]",
    text: "text-[var(--color-forge-info)]",
  },
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "accent",
  loading = false,
}: KpiCardProps) {
  const colors = colorMap[color];

  if (loading) {
    return (
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] transition-colors hover:bg-[var(--color-forge-bg-card-hover)]">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-[var(--color-forge-text-muted)]">
              {title}
            </p>
            <p
              className="text-2xl font-bold text-[var(--color-forge-text-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {value}
            </p>
            <div className="flex items-center gap-2">
              {trend && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.positive
                      ? "text-[var(--color-forge-success)]"
                      : "text-[var(--color-forge-error)]"
                  )}
                >
                  {trend.positive ? "+" : ""}
                  {trend.value}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-[var(--color-forge-text-muted)]">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              colors.bg
            )}
          >
            <Icon className={cn("h-5 w-5", colors.text)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
