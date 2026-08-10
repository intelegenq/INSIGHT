"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

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
}

type SortKey = "tvl" | "volume24h" | "name";
type CategoryFilter = string | "all";

function fmtTvl(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

export default function AnalyticsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("tvl");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const data = (await res.json()) as { projects: Project[] };
      setProjects(data.projects);
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

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">ANALYTICS</p>
        <h1 style={{ fontSize: 32 }}>Solana ecosystem analytics</h1>
        <p className="subtitle">Protocol rankings, TVL, volume, and sector breakdowns</p>
      </div>

      <div className="terminal-main">
        {/* Summary metrics */}
        <div className="terminal-grid terminal-grid-4 mb-4">
          <div className="metric-card">
            <span className="metric-label">Protocols</span>
            <span className="metric-value">{filtered.length}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total TVL</span>
            <span className="metric-value">{fmtTvl(totalTvl)}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">24h Volume</span>
            <span className="metric-value">{fmtTvl(totalVol)}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Categories</span>
            <span className="metric-value">{categories.length - 1}</span>
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
            {categories.map((c) => (
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
          {loading ? (
            <div className="t-loading">Loading analytics...</div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
