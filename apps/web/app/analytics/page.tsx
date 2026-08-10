"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";
import { InsightChart } from "../../components/InsightChart";

interface TimeSeriesPoint {
  label: string;
  projectCount: number;
  narrativeCount: number;
  evidenceCount: number;
}

interface CategoryDist {
  category: string;
  count: number;
}

interface TopProject {
  id: string;
  name: string;
  tvl: number;
  volume24h: number;
  category: string;
}

interface Project {
  id: string;
  name: string;
  category: string;
  description: string;
  metrics: {
    tvl?: number;
    volume24h?: number;
    activeUsers24h?: number;
    developerActivity?: number;
  };
  chain?: string;
  classification?: string;
}

interface AnalyticsData {
  timeSeries: TimeSeriesPoint[];
  categoryDistribution: CategoryDist[];
  topByTvl: TopProject[];
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
  categoryCount: number;
  snapshotCount: number;
}

function fmtTvl(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

type SortKey = "tvl" | "volume24h" | "name";
type CategoryFilter = string | "all";

export default function AnalyticsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Analytics] User is viewing Solana ecosystem analytics with TVL charts, category distribution, protocol rankings, and historical trends.",
    );
  }, [setPageContext]);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("tvl");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [aRes, pRes] = await Promise.all([
        fetch("/api/analytics")
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/projects")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
      ]);
      if (aRes) setAnalytics(aRes);
      // Defensive: filter to solana_ecosystem only — exclude market_context and network
      setProjects(
        (pRes.projects ?? []).filter(
          (p: Project) =>
            p.classification === undefined || p.classification === "solana_ecosystem",
        ),
      );
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = ["all", ...new Set(projects.map((p) => p.category))];
  const filtered = projects
    .filter((p) => category === "all" || p.category === category)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b.metrics[sort] ?? 0) - (a.metrics[sort] ?? 0);
    });

  const totalTvl = filtered.reduce((s, p) => s + (p.metrics.tvl ?? 0), 0);
  const totalVol = filtered.reduce((s, p) => s + (p.metrics.volume24h ?? 0), 0);

  // Chart data
  const projectCountSeries =
    analytics?.timeSeries.map((t) => ({ label: t.label, value: t.projectCount })) ?? [];
  const evidenceSeries =
    analytics?.timeSeries.map((t) => ({ label: t.label, value: t.evidenceCount })) ?? [];
  const categoryChart =
    analytics?.categoryDistribution.map((c) => ({ label: c.category, value: c.count })) ?? [];
  const tvlChart =
    analytics?.topByTvl.map((p) => ({ label: p.name.slice(0, 8), value: p.tvl })) ?? [];

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">ANALYTICS</p>
        <h1 style={{ fontSize: 32 }}>Solana ecosystem analytics</h1>
        <p className="subtitle">
          Protocol rankings, TVL distribution, category breakdowns, and historical trends
        </p>
      </div>

      <div className="terminal-main">
        {loading && <div className="t-loading">Loading analytics...</div>}

        {!loading && (
          <>
            {/* Summary metrics */}
            <div className="terminal-grid terminal-grid-4 mb-4">
              <div className="metric-card">
                <span className="metric-label">Protocols</span>
                <span className="metric-value">{analytics?.projectCount ?? projects.length}</span>
                <span className="metric-sub">Indexed projects</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Total TVL</span>
                <span className="metric-value">{fmtTvl(analytics?.totalTvl ?? totalTvl)}</span>
                <span className="metric-sub">Across all protocols</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">24h Volume</span>
                <span className="metric-value">{fmtTvl(analytics?.totalVolume ?? totalVol)}</span>
                <span className="metric-sub">DEX + protocol volume</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Categories</span>
                <span className="metric-value">
                  {analytics?.categoryCount ?? categories.length - 1}
                </span>
                <span className="metric-sub">Ecosystem sectors</span>
              </div>
            </div>

            {/* Charts row */}
            <div className="terminal-grid terminal-grid-2 mb-4">
              <div className="chart-container">
                <div className="section-header">
                  <div className="section-title">Protocol Count Over Time</div>
                  <span className="text-xs text-muted">
                    {analytics?.snapshotCount ?? 0} snapshots
                  </span>
                </div>
                {projectCountSeries.length > 0 ? (
                  <InsightChart
                    data={projectCountSeries}
                    type="area"
                    color="var(--accent)"
                    height={200}
                    formatValue={(v) => `${v}`}
                  />
                ) : (
                  <div className="t-empty">
                    Historical data requires multiple snapshots. Trigger refreshes to build
                    time-series.
                  </div>
                )}
              </div>
              <div className="chart-container">
                <div className="section-header">
                  <div className="section-title">Evidence Coverage Over Time</div>
                  <span className="text-xs text-muted">Source-backed signals</span>
                </div>
                {evidenceSeries.length > 0 ? (
                  <InsightChart
                    data={evidenceSeries}
                    type="area"
                    color="var(--violet)"
                    height={200}
                    formatValue={(v) => `${v}`}
                  />
                ) : (
                  <div className="t-empty">
                    Historical evidence data requires multiple snapshots.
                  </div>
                )}
              </div>
            </div>

            {/* Category distribution + TVL chart */}
            <div className="terminal-grid terminal-grid-2 mb-4">
              <div className="chart-container">
                <div className="section-header">
                  <div className="section-title">Category Distribution</div>
                </div>
                {categoryChart.length > 0 ? (
                  <InsightChart
                    data={categoryChart}
                    type="bar"
                    color="var(--violet)"
                    height={200}
                    formatValue={(v) => `${v}`}
                  />
                ) : (
                  <div className="t-empty">No category data available.</div>
                )}
              </div>
              <div className="chart-container">
                <div className="section-header">
                  <div className="section-title">Top 10 by TVL</div>
                </div>
                {tvlChart.length > 0 ? (
                  <InsightChart
                    data={tvlChart}
                    type="bar"
                    color="var(--accent)"
                    height={200}
                    formatValue={(v) => fmtTvl(v)}
                  />
                ) : (
                  <div className="t-empty">No TVL data available.</div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-4">
              <input
                className="t-input"
                placeholder="Search protocols..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 300 }}
              />
              <div className="timeframe-controls">
                {(["tvl", "volume24h", "name"] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    className={`timeframe-btn ${sort === k ? "active" : ""}`}
                    onClick={() => setSort(k)}
                  >
                    {k === "tvl" ? "TVL" : k === "volume24h" ? "Volume" : "Name"}
                  </button>
                ))}
              </div>
              <div className="timeframe-controls">
                {categories.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    className={`timeframe-btn ${category === c ? "active" : ""}`}
                    onClick={() => setCategory(c)}
                  >
                    {c === "all" ? "All" : c}
                  </button>
                ))}
              </div>
            </div>

            {/* Rankings table */}
            <div className="t-card" style={{ padding: 0 }}>
              <table className="t-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Protocol</th>
                    <th>Category</th>
                    <th className="right">TVL</th>
                    <th className="right">24h Volume</th>
                    <th className="right">Users</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((p, i) => (
                    <tr key={p.id}>
                      <td className="mono text-muted">{i + 1}</td>
                      <td>
                        <Link href={`/projects/${p.id}`} className="ref-link">
                          {p.name}
                        </Link>
                      </td>
                      <td>
                        <span className="t-badge muted">{p.category}</span>
                      </td>
                      <td className="right mono">{fmtTvl(p.metrics.tvl)}</td>
                      <td className="right mono">{fmtTvl(p.metrics.volume24h)}</td>
                      <td className="right mono">
                        {p.metrics.activeUsers24h ? p.metrics.activeUsers24h.toLocaleString() : "—"}
                      </td>
                      <td className="text-xs text-muted">{p.chain ?? "solana"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 100 && (
              <p className="text-sm text-muted mt-2">Showing 100 of {filtered.length} protocols.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
