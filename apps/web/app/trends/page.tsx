"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface ProjectMetrics {
  tvl?: number;
  volume24h?: number;
  activeUsers24h?: number;
  developerActivity?: number;
}

interface ProjectHealth {
  health: number;
  momentum: number;
  risk: number;
  developer: number;
}

interface TrendPoint {
  snapshotId: string;
  referenceDate: string;
  metrics: ProjectMetrics;
  health: ProjectHealth;
}

interface TrendResponse {
  projectId: string;
  name: string;
  category: string;
  points: TrendPoint[];
  count: number;
}

interface ProjectOption {
  id: string;
  name: string;
  category: string;
}

type LoadState = "idle" | "loading" | "success" | "error";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatMetric(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function formatScore(value: number): string {
  return value.toFixed(1);
}

function trendDir(prev: number, curr: number): "up" | "down" | "flat" {
  if (curr > prev) return "up";
  if (curr < prev) return "down";
  return "flat";
}

function trendArrow(dir: string): string {
  return dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
}

/** Build a simple SVG sparkline for a series of values. */
function Sparkline({
  values,
  min,
  max,
  width = 200,
  height = 48,
  color = "var(--violet)",
}: {
  values: number[];
  min: number;
  max: number;
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) {
    return <svg width={width} height={height} className="trend-sparkline" aria-hidden="true" />;
  }
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = (values.length - 1) * stepX;
  const lastY = height - ((values[values.length - 1]! - min) / range) * (height - 8) - 4;
  return (
    <svg width={width} height={height} className="trend-sparkline" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}

export default function TrendsPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [overlayIds, setOverlayIds] = useState<string[]>([]);
  const [overlayData, setOverlayData] = useState<Record<
    string,
    { name: string; points: TrendPoint[] }
  > | null>(null);
  const [overlayState, setOverlayState] = useState<LoadState>("idle");

  // Load available projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data = (await res.json()) as { projects: ProjectOption[] };
        setProjects(data.projects);
        if (data.projects.length > 0) {
          setSelectedId(data.projects[0]!.id);
        }
      } catch {
        // ignore
      }
    }
    void loadProjects();
  }, []);

  const loadTrend = useCallback(async (id: string) => {
    if (!id) return;
    setState("loading");
    setError("");
    setTrend(null);
    try {
      const res = await fetch(`/api/trends/projects/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setState("success");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as TrendResponse;
      setTrend(data);
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to load trend");
    }
  }, []);

  // Read URL param on mount and when selectedId changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("project");
    if (q && q.length > 0) {
      setSelectedId(q);
      void loadTrend(q);
    } else if (selectedId) {
      void loadTrend(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectProject = (id: string) => {
    setSelectedId(id);
    void loadTrend(id);
  };

  const toggleOverlayProject = useCallback((id: string) => {
    setOverlayIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  }, []);

  const loadOverlay = useCallback(async () => {
    if (overlayIds.length < 2) return;
    setOverlayState("loading");
    try {
      const res = await fetch(`/api/trends/overlay?ids=${overlayIds.join(",")}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        projects: Record<string, { name: string; points: TrendPoint[] }>;
      };
      setOverlayData(data.projects);
      setOverlayState("success");
    } catch {
      setOverlayState("error");
    }
  }, [overlayIds]);

  const points = trend?.points ?? [];
  const healthValues = points.map((p) => p.health.health);
  const momentumValues = points.map((p) => p.health.momentum);
  const riskValues = points.map((p) => p.health.risk);
  const devValues = points.map((p) => p.health.developer);
  const tvlValues = points.map((p) => p.metrics.tvl ?? 0);

  const sparkBounds = (vals: number[]) => ({
    min: Math.min(...vals),
    max: Math.max(...vals),
  });

  const healthBounds = sparkBounds(healthValues);
  const momentumBounds = sparkBounds(momentumValues);
  const riskBounds = sparkBounds(riskValues);
  const devBounds = sparkBounds(devValues);
  const tvlBounds = sparkBounds(tvlValues);

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <div className="nav-links">
          <Link href="/#pulse">Pulse</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/graph">Graph</Link>
          <Link href="/health">Health</Link>
          <Link href="/history">History</Link>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/trends">Trends</Link>
        </div>
      </nav>

      <section className="hero trends-hero">
        <p className="eyebrow">PROJECT TRENDS</p>
        <h1>
          Track health & metrics
          <br />
          <em>over time.</em>
        </h1>
        <p className="hero-copy">
          Select a project to see how its metrics and health scores changed across snapshots. Every
          data point is computed deterministically from Insight&apos;s snapshot history.
        </p>
      </section>

      <section className="section" aria-labelledby="trend-selector-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SELECT PROJECT</p>
            <h2 id="trend-selector-title">Choose a project to track</h2>
          </div>
        </div>
        <div className="compare-selector">
          {projects.map((p) => (
            <button
              key={p.id}
              className={`compare-option ${selectedId === p.id ? "selected" : ""}`}
              onClick={() => onSelectProject(p.id)}
            >
              <span className="compare-option-name">{p.name}</span>
              <span className="category-badge">{p.category}</span>
            </button>
          ))}
        </div>
      </section>

      {state === "loading" && (
        <section className="section">
          <p className="search-status">Loading trend data…</p>
        </section>
      )}

      {state === "error" && (
        <section className="section">
          <p className="search-error">{error}</p>
        </section>
      )}

      {state === "success" && trend && points.length > 0 && (
        <>
          <section className="section" aria-labelledby="trend-overview-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{trend.category.toUpperCase()} · TREND</p>
                <h2 id="trend-overview-title">{trend.name}</h2>
              </div>
              <span className="as-of">
                {points.length} snapshot{points.length === 1 ? "" : "s"} ·{" "}
                {formatDate(points[0]!.referenceDate)} to{" "}
                {formatDate(points[points.length - 1]!.referenceDate)}
              </span>
            </div>

            {/* Sparkline summary cards */}
            <div className="metric-grid">
              <article className="metric-card">
                <span>Health Score</span>
                <Sparkline values={healthValues} min={healthBounds.min} max={healthBounds.max} />
                <small>
                  0–100 scale · {formatScore(points[points.length - 1]!.health.health)} latest
                </small>
              </article>
              <article className="metric-card violet">
                <span>Momentum</span>
                <Sparkline
                  values={momentumValues}
                  min={momentumBounds.min}
                  max={momentumBounds.max}
                />
                <small>
                  −100 to +100 · {formatScore(points[points.length - 1]!.health.momentum)} latest
                </small>
              </article>
              <article className="metric-card">
                <span>Risk</span>
                <Sparkline
                  values={riskValues}
                  min={riskBounds.min}
                  max={riskBounds.max}
                  color="#c62828"
                />
                <small>
                  0–100 scale · {formatScore(points[points.length - 1]!.health.risk)} latest
                </small>
              </article>
              <article className="metric-card">
                <span>Developer</span>
                <Sparkline values={devValues} min={devBounds.min} max={devBounds.max} />
                <small>
                  0–100 scale · {formatScore(points[points.length - 1]!.health.developer)} latest
                </small>
              </article>
            </div>
          </section>

          {/* Detailed trend table */}
          <section className="section" aria-labelledby="trend-table-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">DETAIL</p>
                <h2 id="trend-table-title">Per-snapshot breakdown</h2>
              </div>
            </div>

            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>TVL</th>
                    <th>24h Vol</th>
                    <th>Users</th>
                    <th>Dev Act</th>
                    <th>Health</th>
                    <th>Momentum</th>
                    <th>Risk</th>
                    <th>Dev Score</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((pt, i) => {
                    const prev = i > 0 ? points[i - 1] : null;
                    const hDir = prev ? trendDir(prev.health.health, pt.health.health) : "flat";
                    const mDir = prev ? trendDir(prev.health.momentum, pt.health.momentum) : "flat";
                    return (
                      <tr key={pt.snapshotId}>
                        <td className="compare-row-label">{formatDate(pt.referenceDate)}</td>
                        <td>{formatMetric(pt.metrics.tvl)}</td>
                        <td>{formatMetric(pt.metrics.volume24h)}</td>
                        <td>
                          {pt.metrics.activeUsers24h !== undefined
                            ? pt.metrics.activeUsers24h.toLocaleString()
                            : "—"}
                        </td>
                        <td>{pt.metrics.developerActivity ?? "—"}</td>
                        <td className={`tl-diff-${hDir}`}>
                          {formatScore(pt.health.health)} {trendArrow(hDir)}
                        </td>
                        <td className={`tl-diff-${mDir}`}>
                          {pt.health.momentum > 0 ? "+" : ""}
                          {formatScore(pt.health.momentum)} {trendArrow(mDir)}
                        </td>
                        <td>{formatScore(pt.health.risk)}</td>
                        <td>{formatScore(pt.health.developer)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* TVL sparkline */}
          {tvlValues.some((v) => v > 0) && (
            <section className="section" aria-labelledby="tvl-trend-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">TVL TREND</p>
                  <h2 id="tvl-trend-title">Total value locked over time</h2>
                </div>
              </div>
              <div className="trend-sparkline-large">
                <Sparkline
                  values={tvlValues}
                  min={tvlBounds.min}
                  max={tvlBounds.max}
                  width={600}
                  height={120}
                />
              </div>
            </section>
          )}
        </>
      )}

      {state === "success" && (!trend || points.length === 0) && (
        <section className="section">
          <p className="search-status">
            No trend data available. Take snapshots to start tracking project changes over time.
          </p>
          <Link
            className="primary-button"
            href="/api/refresh"
            style={{ marginTop: 16, display: "inline-flex" }}
          >
            Trigger refresh
          </Link>
        </section>
      )}

      {state === "idle" && (
        <section className="section">
          <p className="search-status">Loading…</p>
        </section>
      )}

      {/* M45: Multi-project trend overlay */}
      <section className="section" aria-labelledby="overlay-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OVERLAY</p>
            <h2 id="overlay-title">Compare multiple projects</h2>
          </div>
        </div>
        <div className="trend-overlay-controls">
          {projects.map((p) => (
            <label key={p.id} className="checkbox-label" style={{ fontSize: 14 }}>
              <input
                type="checkbox"
                checked={overlayIds.includes(p.id)}
                onChange={() => toggleOverlayProject(p.id)}
              />
              {p.name}
            </label>
          ))}
          <button
            type="button"
            className="primary-button"
            onClick={loadOverlay}
            disabled={overlayIds.length < 2 || overlayState === "loading"}
          >
            {overlayState === "loading" ? "Loading…" : "Compare trends"}
          </button>
        </div>

        {overlayState === "success" && overlayData && (
          <>
            <div className="overlay-legend">
              {Object.entries(overlayData).map(([pid, data], i) => {
                const colors = [
                  "var(--violet)",
                  "#2e7d32",
                  "#e65100",
                  "#1565c0",
                  "#c62828",
                  "#6a1b9a",
                  "#00838f",
                  "#bf360c",
                  "#455a64",
                  "#827717",
                ];
                const color = colors[i % colors.length];
                return (
                  <span key={pid} className="overlay-legend-item">
                    <span className="overlay-legend-dot" style={{ background: color }} />
                    {data.name}
                  </span>
                );
              })}
            </div>
            <div className="overlay-chart">
              <svg width={600} height={200} aria-label="Multi-project health score overlay">
                {(() => {
                  const allPoints = Object.values(overlayData).flatMap((d) => d.points);
                  if (allPoints.length < 2)
                    return (
                      <text x={20} y={100} fill="var(--muted)">
                        Not enough data points
                      </text>
                    );
                  const dates = [...new Set(allPoints.map((p) => p.referenceDate))].sort();
                  const width = 600;
                  const height = 200;
                  const stepX = dates.length > 1 ? width / (dates.length - 1) : 0;
                  const colors = [
                    "var(--violet)",
                    "#2e7d32",
                    "#e65100",
                    "#1565c0",
                    "#c62828",
                    "#6a1b9a",
                    "#00838f",
                    "#bf360c",
                    "#455a64",
                    "#827717",
                  ];
                  return Object.entries(overlayData).map(([pid, data], i) => {
                    const color = colors[i % colors.length];
                    const vals = dates.map((d) => {
                      const pt = data.points.find((p) => p.referenceDate === d);
                      return pt?.health.health ?? null;
                    });
                    const pts = vals
                      .map((v, j) =>
                        v === null
                          ? null
                          : `${(j * stepX).toFixed(1)},${(height - (v / 100) * (height - 20) - 10).toFixed(1)}`,
                      )
                      .filter((p): p is string => p !== null)
                      .join(" ");
                    return (
                      <polyline
                        key={pid}
                        points={pts}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    );
                  });
                })()}
              </svg>
            </div>
          </>
        )}

        {overlayState === "error" && <p className="search-error">Failed to load overlay data.</p>}
      </section>

      <footer>
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <p>Built for better questions about Solana.</p>
        <p>© 2026 Insight</p>
      </footer>
    </main>
  );
}
