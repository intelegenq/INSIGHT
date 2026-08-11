"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { InsightChart } from "../../components/InsightChart";
import { ProjectLogo } from "../../components/ProjectLogo";
import { useCopilot } from "../../components/Copilot";

// ── Types ──────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  category: string;
  metrics: { tvl?: number; volume24h?: number };
  logoUrl?: string;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  classification?: string;
}

interface AnalyticsData {
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
  categoryCount: number;
  categoryDistribution: { category: string; count: number }[];
  topByTvl: { id: string; name: string; tvl: number; category: string; volume24h: number }[];
}

interface NetworkMetrics {
  dexVolume: {
    total24h: number;
    protocols: { name: string; volume24h: number }[];
  } | null;
  feesRevenue: {
    total24hFees: number;
    total7dFees: number;
    total30dFees: number;
    protocols: { name: string; fees24h: number }[];
  } | null;
}

interface Etf {
  name: string;
  ticker: string;
  staking: boolean;
  aum: number | null;
}

// ── Formatters ─────────────────────────────────────────────────

function fmtUsd(v: number | undefined | null): string {
  if (v === undefined || v === null || v === 0) return "\u2014";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function fmtPct(v: number | undefined): string {
  if (v === undefined) return "\u2014";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function changeColor(v: number | undefined): string {
  if (v === undefined) return "var(--text-muted)";
  return v >= 0 ? "var(--green)" : "var(--red)";
}

// ── Style constants ────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 590,
  letterSpacing: "-0.01em",
  color: "var(--text)",
  marginBottom: 16,
};

const metricLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const metricValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  color: "var(--text)",
  marginTop: 4,
};

const sourceNote: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
  marginTop: 8,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 8px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
};

const monoRight: React.CSSProperties = {
  textAlign: "right",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 180,
  padding: "6px 10px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: "3px 10px",
  fontSize: 11,
  fontWeight: 510,
  fontFamily: "var(--font-mono)",
  background: active ? "var(--accent)" : "transparent",
  color: active ? "var(--accent-fg)" : "var(--text-muted)",
  border: "1px solid var(--card-border)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
});

const sortBtn = (active: boolean): React.CSSProperties => ({
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 510,
  fontFamily: "var(--font-mono)",
  background: active ? "var(--accent)" : "transparent",
  color: active ? "var(--accent-fg)" : "var(--text-muted)",
  border: "1px solid var(--card-border)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
});

// ── Component ──────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Analytics] Solana ecosystem overview: TVL, DEX volume, fees, ETF flows, category breakdown, protocol rankings.",
    );
  }, [setPageContext]);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics | null>(null);
  const [etfs, setEtfs] = useState<Etf[]>([]);
  const [loading, setLoading] = useState(true);

  // Rankings controls
  const [sort, setSort] = useState<"tvl" | "volume24h" | "name">("tvl");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [aRes, pRes, nmRes, etfRes] = await Promise.all([
        fetch("/api/analytics")
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/projects?classification=solana_ecosystem")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
        fetch("/api/network-metrics")
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/etf-flows")
          .then((r) => r.json())
          .catch(() => ({ etfs: [] })),
      ]);
      if (aRes) setAnalytics(aRes);
      setProjects(pRes.projects ?? []);
      if (nmRes) setNetworkMetrics(nmRes);
      setEtfs(etfRes.etfs ?? []);
      setLoading(false);
    })();
  }, []);

  // ── Derived data ──────────────────────────────────────────────
  // Exclude the chain-level "Solana" entry (category "other", ~$44B TVL) —
  // it's the L1 itself, not an ecosystem protocol, and would dominate rankings.
  const isChainEntry = (p: Project) =>
    p.name.toLowerCase() === "solana" || p.id?.toLowerCase().startsWith("solana-");

  const eco = projects.filter(
    (p) =>
      (!p.classification || p.classification === "solana_ecosystem") && !isChainEntry(p),
  );
  const categories = ["all", ...new Set(eco.map((p) => p.category))];
  const filtered = eco
    .filter((p) => category === "all" || p.category === category)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b.metrics[sort] ?? 0) - (a.metrics[sort] ?? 0);
    });

  const catChart =
    analytics?.categoryDistribution
      ?.slice(0, 12)
      .map((c) => ({ label: c.category, value: c.count })) ?? [];

  const feesChart =
    networkMetrics?.feesRevenue?.protocols
      ?.slice(0, 20)
      .map((p) => ({ label: p.name.slice(0, 12), value: p.fees24h })) ?? [];

  const dexVol = networkMetrics?.dexVolume;
  const feesRev = networkMetrics?.feesRevenue;

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="a-page">
        <div className="a-empty">Loading…</div>
      </div>
    );
  }

  // ── Metric strip ─────────────────────────────────────────────

  const metrics = [
    { label: "Total TVL", value: fmtUsd(analytics?.totalTvl) },
    { label: "DEX Volume 24h", value: fmtUsd(dexVol?.total24h ?? analytics?.totalVolume) },
    { label: "Fees 24h", value: fmtUsd(feesRev?.total24hFees) },
    { label: "Protocols", value: analytics ? String(analytics.projectCount) : "\u2014" },
    { label: "Categories", value: analytics ? String(analytics.categoryCount) : "\u2014" },
  ];

  // Blockworks-style grid data
  const topTvlChart = (analytics?.topByTvl ?? [])
    .slice(0, 15)
    .map((p) => ({ label: p.name.slice(0, 10), value: p.tvl }));

  const dexVolChart = (dexVol?.protocols ?? [])
    .slice(0, 15)
    .map((p) => ({ label: p.name.slice(0, 10), value: p.volume24h }));

  return (
    <div className="a-page">
      {/* Header */}
      <div className="a-head">
        <h1 className="a-title">Overview</h1>
        <p className="a-subtitle">
          Solana ecosystem-wide metrics — aggregate TVL, DEX volume, fees, and category breakdown
        </p>
      </div>

      {/* ── Row 1 (8/4): hero + KPI stack ─────────────────────── */}
      <div className="a-grid a-grid-hero">
        <div className="a-card a-span-8">
          <div className="a-card-title">Top Protocols by TVL</div>
          <div className="a-card-sub">
            Largest Solana ecosystem protocols by total value locked
          </div>
          <div className="a-card-body">
            {topTvlChart.length > 0 ? (
              <InsightChart data={topTvlChart} type="bar" height={280} formatValue={fmtUsd} />
            ) : (
              <div className="a-empty">Data unavailable</div>
            )}
          </div>
        </div>

        <div className="a-span-4">
          <div className="a-card a-stat">
            <div>
              <div className="a-card-title">Total TVL</div>
              <div className="a-card-sub">Ecosystem-wide</div>
            </div>
            <div className="a-stat-value">{fmtUsd(analytics?.totalTvl)}</div>
            <div className="a-stat-label">Total value locked</div>
          </div>
          <div className="a-card a-stat">
            <div>
              <div className="a-card-title">DEX Volume 24h</div>
              <div className="a-card-sub">Aggregate</div>
            </div>
            <div className="a-stat-value">{fmtUsd(dexVol?.total24h ?? analytics?.totalVolume)}</div>
            <div className="a-stat-label">Routed volume</div>
          </div>
        </div>
      </div>

      {/* ── Row 2 (6/6): DEX volume + Fees ─────────────────────── */}
      <div className="a-grid a-grid-2" style={{ marginBottom: 44 }}>
        <div className="a-card">
          <div className="a-card-title">DEX Volume by Protocol</div>
          <div className="a-card-sub">Top DEXs by 24h routed volume</div>
          <div className="a-card-body">
            {dexVolChart.length > 0 ? (
              <InsightChart data={dexVolChart} type="bar" height={260} formatValue={fmtUsd} />
            ) : (
              <div className="a-empty">Data unavailable</div>
            )}
          </div>
        </div>

        <div className="a-card">
          <div className="a-card-title">Fees &amp; Revenue</div>
          <div className="a-card-sub">
            Top protocols by 24h fees — {fmtUsd(feesRev?.total24hFees)} total
          </div>
          <div className="a-card-body">
            {feesChart.length > 0 ? (
              <InsightChart data={feesChart} type="bar" height={260} formatValue={fmtUsd} />
            ) : (
              <div className="a-empty">Data unavailable</div>
            )}
          </div>
        </div>
      </div>
        <div style={{ marginTop: 40 }}>
          <div style={sectionTitle}>Protocol Rankings</div>

          {/* Controls */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              placeholder="Search protocols..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {(["tvl", "volume24h", "name"] as const).map((k) => (
                <button key={k} onClick={() => setSort(k)} style={sortBtn(sort === k)}>
                  {k === "tvl" ? "TVL" : k === "volume24h" ? "VOLUME" : "NAME"}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter buttons */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {categories.slice(0, 20).map((c) => (
              <button key={c} onClick={() => setCategory(c)} style={filterBtn(category === c)}>
                {c === "all" ? "ALL" : c}
              </button>
            ))}
          </div>

          {/* Table */}
          {filtered.length > 0 ? (
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <table className="t-table">
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 32 }}>#</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Category</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>TVL</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>24h</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>7d</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>30d</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 50).map((p, i) => (
                    <tr key={p.id}>
                      <td
                        style={{
                          ...tdStyle,
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                      >
                        {i + 1}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ProjectLogo src={p.logoUrl} name={p.name} size={18} />
                          <Link
                            href={`/analytics/${encodeURIComponent(p.name.toLowerCase().replace(/\s+/g, "-"))}`}
                            style={{ fontSize: 13, color: "var(--text)" }}
                          >
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-muted)" }}>
                        {p.category}
                      </td>
                      <td style={{ ...tdStyle, ...monoRight }}>{fmtUsd(p.metrics?.tvl)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          ...monoRight,
                          color: changeColor(p.change24h),
                        }}
                      >
                        {fmtPct(p.change24h)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          ...monoRight,
                          color: changeColor(p.change7d),
                        }}
                      >
                        {fmtPct(p.change7d)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          ...monoRight,
                          color: changeColor(p.change30d),
                        }}
                      >
                        {fmtPct(p.change30d)}
                      </td>
                      <td style={{ ...tdStyle, ...monoRight }}>{fmtUsd(p.metrics?.volume24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={sourceNote}>
                Showing {Math.min(50, filtered.length)} of {filtered.length} protocols
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              No protocols found.
            </div>
          )}
        </div>

        {/* ── 4. Fees / Revenue ────────────────────────────────── */}
        <div style={{ marginTop: 40 }}>
          <div style={sectionTitle}>Fees &amp; Revenue — Top 20 Protocols</div>
          {feesChart.length > 0 ? (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  marginBottom: 16,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>
                  24h: <span style={{ color: "var(--text)" }}>{fmtUsd(feesRev?.total24hFees)}</span>
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  7d: <span style={{ color: "var(--text)" }}>{fmtUsd(feesRev?.total7dFees)}</span>
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  30d: <span style={{ color: "var(--text)" }}>{fmtUsd(feesRev?.total30dFees)}</span>
                </span>
              </div>
              <InsightChart
                data={feesChart}
                type="bar"
                color="var(--accent)"
                height={250}
                formatValue={(v) => fmtUsd(v)}
              />
            </>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Data unavailable
            </div>
          )}
        </div>

        {/* ── 5. ETF Flows ─────────────────────────────────────── */}
        <div style={{ marginTop: 40 }}>
          <div style={sectionTitle}>ETF Flows</div>
          {etfs.length > 0 ? (
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <table className="t-table">
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Ticker</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>AUM</th>
                    <th style={thStyle}>Staking</th>
                  </tr>
                </thead>
                <tbody>
                  {etfs.map((etf) => (
                    <tr key={etf.ticker}>
                      <td style={tdStyle}>{etf.name}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "var(--accent)",
                        }}
                      >
                        {etf.ticker}
                      </td>
                      <td style={{ ...tdStyle, ...monoRight }}>{fmtUsd(etf.aum ?? 0)}</td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>
                        <span
                          style={{
                            color: etf.staking ? "var(--green)" : "var(--text-muted)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {etf.staking ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Data unavailable
            </div>
          )}
          <div style={sourceNote}>Source: SolanaFloor</div>
        </div>

        {/* ── 6. Source attribution ────────────────────────────── */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Source: DeFiLlama, SolanaFloor
        </div>
    </div>
  );
}
