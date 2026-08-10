"use client";

import { useMemo } from "react";

interface ChartProps {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  type?: "line" | "bar" | "area";
  showAxis?: boolean;
  formatValue?: (v: number) => string;
}

/**
 * InsightChart — reusable SVG chart component.
 * Supports line, bar, and area charts. No external dependencies.
 */
export function InsightChart({
  data,
  width = 600,
  height = 180,
  color = "var(--accent)",
  fill = true,
  type = "line",
  showAxis = true,
  formatValue,
}: ChartProps) {
  const { path, areaPath, bars, points, maxVal, minVal } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: "", areaPath: "", bars: [], points: [], maxVal: 0, minVal: 0 };
    }

    const values = data.map((d) => d.value);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const padding = { top: 20, bottom: showAxis ? 28 : 10, left: showAxis ? 50 : 10, right: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const xStep = chartW / Math.max(data.length - 1, 1);
    const yScale = (v: number) => padding.top + chartH - ((v - min) / range) * chartH;
    const xPos = (i: number) => padding.left + i * xStep;

    if (type === "bar") {
      const barWidth = Math.max((chartW / data.length) * 0.6, 2);
      const barsArr = data.map((d, i) => ({
        x: padding.left + i * xStep - barWidth / 2 + xStep / 2,
        y: yScale(d.value),
        w: barWidth,
        h: yScale(min) - yScale(d.value),
        label: d.label,
        value: d.value,
      }));
      return { path: "", areaPath: "", bars: barsArr, points: [], maxVal: max, minVal: min };
    }

    const pts = data.map((d, i) => ({
      x: xPos(i),
      y: yScale(d.value),
      value: d.value,
      label: d.label,
    }));
    const pathStr = pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    const areaStr = `${pathStr} L ${pts[pts.length - 1]!.x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} L ${pts[0]!.x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`;

    return { path: pathStr, areaPath: areaStr, bars: [], points: pts, maxVal: max, minVal: min };
  }, [data, width, height, type, showAxis]);

  if (!data || data.length === 0) {
    return (
      <div className="t-empty" style={{ height }}>
        No historical data available for this metric.
      </div>
    );
  }

  const fmt = formatValue ?? ((v: number) => v.toLocaleString());
  const padLeft = showAxis ? 50 : 10;
  const padBottom = showAxis ? 28 : 10;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="chart-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {showAxis && (
        <>
          {/* Y-axis labels */}
          <text
            x={padLeft - 8}
            y={22}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
          >
            {fmt(maxVal)}
          </text>
          <text
            x={padLeft - 8}
            y={height - padBottom + 4}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
          >
            {fmt(minVal)}
          </text>
          {/* Grid line at top */}
          <line
            x1={padLeft}
            y1={20}
            x2={width - 10}
            y2={20}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          {/* Grid line at bottom */}
          <line
            x1={padLeft}
            y1={height - padBottom}
            x2={width - 10}
            y2={height - padBottom}
            stroke="var(--border)"
            strokeWidth="1"
          />
        </>
      )}

      {type === "bar" &&
        bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={Math.max(b.h, 1)}
            fill={color}
            opacity={0.8}
            rx="2"
          >
            <title>
              {b.label}: {fmt(b.value)}
            </title>
          </rect>
        ))}

      {type !== "bar" && (
        <>
          {fill && <path d={areaPath} fill={color} opacity="0.08" />}
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill="var(--bg)"
              stroke={color}
              strokeWidth="1.5"
            >
              <title>
                {p.label}: {fmt(p.value)}
              </title>
            </circle>
          ))}
        </>
      )}

      {showAxis &&
        data.length <= 12 &&
        data.map((d, i) => {
          const x = padLeft + i * ((width - padLeft - 10) / Math.max(data.length - 1, 1));
          return (
            <text
              key={i}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
            >
              {d.label}
            </text>
          );
        })}
    </svg>
  );
}

/** Mini sparkline for metric cards — no axis, compact */
export function Sparkline({
  values,
  color = "var(--accent)",
  width = 120,
  height = 32,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const data = values.map((v, i) => ({ label: `${i}`, value: v }));
  return (
    <InsightChart
      data={data}
      width={width}
      height={height}
      color={color}
      fill={true}
      showAxis={false}
      type="line"
    />
  );
}
