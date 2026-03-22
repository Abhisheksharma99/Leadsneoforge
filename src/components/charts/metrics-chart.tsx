"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Obsidian Forge chart colors ─────────────────────────────────────────────
const CHART_COLORS = {
  accent: "#e8a23e",
  secondary: "#818cf8",
  success: "#34d399",
  info: "#60a5fa",
  error: "#f87171",
  warning: "#fbbf24",
};

const PIE_COLORS = [
  CHART_COLORS.success,
  CHART_COLORS.accent,
  CHART_COLORS.secondary,
  CHART_COLORS.info,
  CHART_COLORS.error,
];

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs text-[var(--color-forge-text-muted)]">
        {label}
      </p>
      {payload.map((entry, idx) => (
        <p
          key={idx}
          className="text-sm font-medium"
          style={{ color: entry.color }}
        >
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Metrics Line Chart ──────────────────────────────────────────────────────

interface MetricsLineChartProps {
  data: Array<{
    date: string;
    reddit_matches_count: number;
    reddit_total_karma: number | null;
    posts_scheduled: number;
    posts_published: number;
  }>;
  loading?: boolean;
}

export function MetricsLineChart({ data, loading }: MetricsLineChartProps) {
  if (loading) {
    return (
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-forge-text-primary)]">
            Metrics Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    "Reddit Matches": d.reddit_matches_count,
    Karma: d.reddit_total_karma ?? 0,
    Scheduled: d.posts_scheduled,
    Published: d.posts_published,
  }));

  return (
    <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
      <CardHeader>
        <CardTitle className="text-[var(--color-forge-text-primary)]">
          Karma & Matches Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b6b67", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            />
            <YAxis
              tick={{ fill: "#6b6b67", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ color: "#a8a8a4", fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="Reddit Matches"
              stroke={CHART_COLORS.accent}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.accent, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Karma"
              stroke={CHART_COLORS.secondary}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.secondary, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Scheduled"
              stroke={CHART_COLORS.info}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.info, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Published"
              stroke={CHART_COLORS.success}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.success, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Directory Status Pie Chart ──────────────────────────────────────────────

interface DirectoryPieChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  loading?: boolean;
}

export function DirectoryPieChart({ data, loading }: DirectoryPieChartProps) {
  if (loading) {
    return (
      <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-forge-text-primary)]">
            Directory Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const filteredData = data.filter((d) => d.value > 0);

  return (
    <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
      <CardHeader>
        <CardTitle className="text-[var(--color-forge-text-primary)]">
          Directory Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {filteredData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ color: "#a8a8a4", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
