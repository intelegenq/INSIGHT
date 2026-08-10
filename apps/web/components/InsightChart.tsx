"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  LineChart,
  Cell,
} from "recharts";

interface ChartData {
  label: string;
  value: number;
}

const COLORS = {
  brown: "#8b6f47",
  green: "#059669",
  red: "#dc2626",
  blue: "#2563eb",
  purple: "#7c3aed",
  linen: "#faf6f0",
  text: "#3d2e1e",
  muted: "#b5a690",
  border: "#e8dfd3",
};

const tooltipStyle = {
  backgroundColor: "#fdfbf7",
  border: `1px solid ${COLORS.border}`,
  borderRadius: "6px",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  color: COLORS.text,
};

interface InsightChartProps {
  data: ChartData[];
  type?: "line" | "bar" | "area";
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}

export function InsightChart({
  data,
  type = "line",
  height = 200,
  color = COLORS.brown,
  formatValue,
}: InsightChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: COLORS.muted, fontSize: 13 }}>
        No data available.
      </div>
    );
  }

  const fmt = formatValue ?? ((v: number) => v.toLocaleString());

  // Sample data if too many points
  const sampled =
    data.length > 100 ? data.filter((_, i) => i % Math.ceil(data.length / 100) === 0) : data;

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={sampled} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: COLORS.muted }}
            axisLine={{ stroke: COLORS.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: COLORS.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmt(v)}
            width={50}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={((v: unknown) => fmt(Number(v))) as never}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Area and Line charts
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={sampled} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <defs>
          <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: COLORS.muted }}
          axisLine={{ stroke: COLORS.border }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: COLORS.muted }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmt(v)}
          width={50}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={((v: unknown) => fmt(Number(v))) as never}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill="url(#colorGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Mini sparkline for metric cards */
export function Sparkline({
  data,
  color = COLORS.green,
  height = 32,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (!data || data.length === 0) return null;
  const chartData = data.map((v, i) => ({ label: `${i}`, value: v }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
