"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InsightChart } from "../components/InsightChart";
import { ProjectLogo } from "../components/ProjectLogo";
import { useCopilot } from "../components/Copilot";

// ── Types (matching API response shapes) ──────────────────────

interface PricePoint {
  timestamp: string;
  price: number;
}

interface SolanaPriceResponse {
  prices: PricePoint[];
  marketCaps: { timestamp: string; value: number }[];
  volumes: { timestamp: string; value: number }[];
  current: {
    price: number;
    marketCap: number;
    volume: number;
    change24h?: number;
    change7d?: number;
    change30d?: number;
    circulatingSupply?: number;
    high24h?: number;
    low24h?: number;
  } | null;
}

interface SourceHealthEntry {
  id: string;
  name: string;
  available: boolean;
  note?: string;
  status: "healthy" | "degraded" | "unavailable";
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unavailable";
  checkedAt: string;
  providers: SourceHealthEntry[];
  summary: { total: number; healthy: number; unavailable: number };
}

interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  source: string;
  confidence: string;
}

interface PulseMetric {
  id: string;
  label: string;
  value: string;
  caption: string;
}

interface PulseResponse {
  pulse: { asOf: string; metrics: PulseMetric[] };
  timeline: TimelineEvent[];
}

interface Project {
  id: string;
  name: string;
  category: string;
  description: string;
  metrics: { tvl?: number; volume24h?: number; activeUsers24h?: number };
  classification?: string;
  logoUrl?: string;
  symbol?: string;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  website?: string;
  twitter?: string;
  github?: string;
  slug?: string;
}

interface ProjectsResponse {
  projects: Project[];
  count: number;
}

interface Narrative {
  id: string;
  name: string;
  trend: "up" | "down" | "flat" | "watch";
  change?: string;
  note: string;
  projectIds: string[];
}

interface NarrativesResponse {
  narratives: Narrative[];
  count: number;
}

interface AnalyticsResponse {
  timeSeries: {
    label: string;
    projectCount: number;
    narrativeCount: number;
    evidenceCount: number;
  }[];
  categoryDistribution: { category: string; count: number }[];
  topByTvl: {
    name: string;
    tvl: number;
    volume24h: number;
    category: string;
    id: string;
  }[];
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
  categoryCount: number;
}

// ── Helpers ───────────────────────────────────────────────────

function fmtUsd(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtPct(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function changeClass(v: number | undefined | null): string {
  if (v === undefined || v === null) return "metric-change flat";
  if (v > 0) return "metric-change up";
  if (v < 0) return "metric-change down";
  return "metric-change flat";
}

function changeArrow(v: number | undefined | null): string {
  if (v === undefined || v === null) return "";
  if (v > 0) return "▲";
  if (v < 0) return "▼";
  return "▬";
}

// ── Component ─────────────────────────────────────────────────

export default function Home() {
  const { setPageContext } = useCopilot();

  const [priceData, setPriceData] = useState<SolanaPriceResponse | null>(null);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [pulseData, setPulseData] = useState<PulseResponse | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectsResponse | null>(null);
  const [narrativesData, setNarrativesData] = useState<NarrativesResponse | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageContext(
      "[Overview] User is viewing the Insight homepage — Solana price chart, market snapshot, network health, real-time feed, top projects, narratives, and category distribution.",
    );
  }, [setPageContext]);

  const load = useCallback(async () => {
    setLoading(true);
    const [priceRes, healthRes, pulseRes, projectsRes, narrativesRes, analyticsRes] =
      await Promise.all([
        fetch("/api/solana-price?days=30").catch(() => null),
        fetch("/api/health").catch(() => null),
        fetch("/api/pulse").catch(() => null),
        fetch("/api/projects?classification=solana_ecosystem").catch(() => null),
        fetch("/api/narratives").catch(() => null),
        fetch("/api/analytics").catch(() => null),
      ]);

    if (priceRes?.ok) {
      setPriceData((await priceRes.json()) as SolanaPriceResponse);
    }
    if (healthRes?.ok) {
      setHealthData((await healthRes.json()) as HealthResponse);
    }
    if (pulseRes?.ok) {
      setPulseData((await pulseRes.json()) as PulseResponse);
    }
    if (projectsRes?.ok) {
      setProjectsData((await projectsRes.json()) as ProjectsResponse);
    }
    if (narrativesRes?.ok) {
      setNarrativesData((await narrativesRes.json()) as NarrativesResponse);
    }
    if (analyticsRes?.ok) {
      setAnalyticsData((await analyticsRes.json()) as AnalyticsResponse);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived data ────────────────────────────────────────────

  const priceChartData =
    priceData?.prices?.map((p) => ({
      label: new Date(p.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: p.price,
    })) ?? [];

  const current = priceData?.current;
  const projects = projectsData?.projects ?? [];
  const timeline = pulseData?.timeline ?? [];
  const narratives = narrativesData?.narratives ?? [];
  const topProjects = analyticsData?.topByTvl ?? [];
  const categoryDist = analyticsData?.categoryDistribution ?? [];
  const totalTvl = analyticsData?.totalTvl ?? 0;
  const totalVolume = analyticsData?.totalVolume ?? 0;
  const providers = healthData?.providers ?? [];

  // Category distribution as bar chart data (top 10)
  const categoryChartData = categoryDist.slice(0, 10).map((c) => ({
    label: c.category,
    value: c.count,
  }));

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">SOLANA INTELLIGENCE TERMINAL</p>
        <h1>
          Everything happening across Solana, <em>in one terminal.</em>
        </h1>
        <p className="hero-copy">
          Real-time data from Solana RPC, DeFiLlama, CoinGecko, and Helius — with evidence
          traceability, anomaly detection, and grounded AI analysis.
        </p>
      </div>

      <div className="terminal-main">
        {/* ═══ SOL PRICE CHART ═══ */}
        <div className="terminal-section">
          <div className="section-header">
            <div>
              <div className="section-title">SOL Price · 30D</div>
              <div className="section-subtitle">
                {current
                  ? `$${current.price.toFixed(2)} · ${fmtPct(current.change24h)} (24h)`
                  : "Loading price data..."}
              </div>
            </div>
          </div>
          <div className="chart-container">
            {loading && priceChartData.length === 0 ? (
              <div className="t-loading">Fetching SOL price history from CoinGecko...</div>
            ) : priceChartData.length > 0 ? (
              <InsightChart
                data={priceChartData}
                type="area"
                color="var(--accent)"
                height={220}
                formatValue={(v) => `$${v.toFixed(2)}`}
              />
            ) : (
              <div className="t-empty">Unable to load SOL price data.</div>
            )}
          </div>
        </div>

        {/* ═══ MARKET SNAPSHOT ═══ */}
        <div className="terminal-section">
          <div className="section-header">
            <div>
              <div className="section-title">Market Snapshot</div>
              <div className="section-subtitle">
                {current
                  ? `Updated ${new Date().toLocaleTimeString()}`
                  : "Fetching live market data..."}
              </div>
            </div>
          </div>
          <div className="terminal-grid terminal-grid-4">
            <div className="metric-card">
              <span className="metric-label">SOL Price</span>
              <span className="metric-value">{current ? `$${current.price.toFixed(2)}` : "—"}</span>
              {current?.change24h !== undefined && (
                <span className={changeClass(current.change24h)}>
                  {changeArrow(current.change24h)} {fmtPct(current.change24h)}
                </span>
              )}
            </div>
            <div className="metric-card">
              <span className="metric-label">Market Cap</span>
              <span className="metric-value">{current ? fmtUsd(current.marketCap) : "—"}</span>
              <span className="metric-sub">
                {current?.circulatingSupply
                  ? `${(current.circulatingSupply / 1e6).toFixed(1)}M SOL circulating`
                  : "—"}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Total TVL</span>
              <span className="metric-value">{fmtUsd(totalTvl)}</span>
              <span className="metric-sub">
                {analyticsData ? `${analyticsData.projectCount} protocols` : "—"}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">24h DEX Volume</span>
              <span className="metric-value">{fmtUsd(totalVolume)}</span>
              <span className="metric-sub">
                {current ? `SOL 24h vol: ${fmtUsd(current.volume)}` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ NETWORK HEALTH BAR ═══ */}
        <div className="terminal-section">
          <div className="section-header">
            <div>
              <div className="section-title">Network Health</div>
              <div className="section-subtitle">
                {healthData
                  ? `${healthData.summary.healthy}/${healthData.summary.total} sources healthy · ${healthData.status}`
                  : "Checking data source health..."}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {loading && providers.length === 0 && (
              <div className="t-loading" style={{ padding: 16 }}>
                Fetching source health...
              </div>
            )}
            {providers.map((p) => (
              <span
                key={p.id}
                className={`t-badge ${p.status === "healthy" ? "green" : p.status === "degraded" ? "yellow" : "red"}`}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    display: "inline-block",
                    marginRight: 6,
                    background:
                      p.status === "healthy"
                        ? "var(--green)"
                        : p.status === "degraded"
                          ? "var(--yellow)"
                          : "var(--red)",
                  }}
                />
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* ═══ SOLANA NOW FEED ═══ */}
        <div className="terminal-section">
          <div className="section-header">
            <div>
              <div className="section-title">Solana Now</div>
              <div className="section-subtitle">Real-time intelligence feed</div>
            </div>
            <Link href="/solana-now" className="t-card-link">
              View all →
            </Link>
          </div>
          <div className="solana-now">
            {loading && timeline.length === 0 && (
              <div className="t-loading">Fetching real-time feed...</div>
            )}
            {timeline.slice(0, 6).map((t, i) => {
              const badgeClass = i === 0 ? "breaking" : i === 1 ? "alert" : "event";
              const badgeText = i === 0 ? "BREAKING" : i === 1 ? "DATA ALERT" : "NEWS";
              return (
                <div key={t.id} className="feed-item">
                  <span className={`feed-badge ${badgeClass}`}>{badgeText}</span>
                  <div className="feed-content">
                    <div className="feed-headline">{t.title}</div>
                    <div className="feed-meta">
                      <span className="feed-source">{t.source}</span>
                      <span>·</span>
                      <span>{t.confidence}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {timeline.length === 0 && !loading && (
              <div className="t-empty">No real-time updates yet.</div>
            )}
          </div>
        </div>

        {/* ═══ TOP PROJECTS + NARRATIVES ═══ */}
        <div className="terminal-grid terminal-grid-2">
          {/* Top Projects Table with Logos */}
          <div className="terminal-section">
            <div className="section-header">
              <div className="section-title">Top Protocols by TVL</div>
              <Link href="/ecosystem" className="t-card-link">
                All →
              </Link>
            </div>
            <div className="t-card" style={{ padding: 0 }}>
              {loading && topProjects.length === 0 && (
                <div className="t-loading">Loading projects...</div>
              )}
              {topProjects.length > 0 && (
                <table className="t-table">
                  <thead>
                    <tr>
                      <th>Protocol</th>
                      <th className="right">TVL</th>
                      <th className="right">24h Vol</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProjects.slice(0, 8).map((p, i) => {
                      const project = projects.find((proj) => proj.id === p.id);
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <ProjectLogo src={project?.logoUrl} name={p.name} size={20} />
                              <Link href={`/projects/${p.id}`} className="ref-link">
                                {p.name}
                              </Link>
                            </div>
                          </td>
                          <td className="right mono">{fmtUsd(p.tvl)}</td>
                          <td className="right mono">{fmtUsd(p.volume24h)}</td>
                          <td>
                            <span className="t-badge muted">{p.category}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {topProjects.length === 0 && !loading && (
                <div className="t-empty">No project data available.</div>
              )}
            </div>
          </div>

          {/* Active Narratives */}
          <div className="terminal-section">
            <div className="section-header">
              <div className="section-title">Active Narratives</div>
              <Link href="/ecosystem" className="t-card-link">
                All →
              </Link>
            </div>
            <div className="t-card">
              {loading && narratives.length === 0 && (
                <div className="t-loading">Loading narratives...</div>
              )}
              {narratives.map((n) => (
                <Link
                  href={`/narratives/${n.id}`}
                  key={n.id}
                  className="narrative-card-link"
                  style={{ marginBottom: 8, display: "block" }}
                >
                  <div className="narrative-card-header">
                    <h4>{n.name}</h4>
                    <span className={`trend-badge trend-${n.trend}`}>{n.trend}</span>
                  </div>
                  <p className="narrative-note">{n.note}</p>
                  {n.change && <span className="narrative-change">{n.change}</span>}
                </Link>
              ))}
              {narratives.length === 0 && !loading && (
                <div className="t-empty">No narratives detected.</div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ CATEGORY DISTRIBUTION CHART ═══ */}
        <div className="terminal-section">
          <div className="section-header">
            <div>
              <div className="section-title">Category Distribution</div>
              <div className="section-subtitle">
                {analyticsData
                  ? `${analyticsData.projectCount} projects across ${analyticsData.categoryCount} categories`
                  : "Loading analytics..."}
              </div>
            </div>
          </div>
          <div className="chart-container">
            {loading && categoryChartData.length === 0 ? (
              <div className="t-loading">Computing category distribution...</div>
            ) : categoryChartData.length > 0 ? (
              <InsightChart
                data={categoryChartData}
                type="bar"
                color="var(--violet)"
                height={200}
              />
            ) : (
              <div className="t-empty">No category data available.</div>
            )}
          </div>
        </div>

        {/* ═══ QUICK LINKS ═══ */}
        <div className="terminal-section">
          <div className="terminal-grid terminal-grid-4">
            <Link href="/analytics" className="t-card" style={{ textDecoration: "none" }}>
              <div className="t-card-title">Analytics</div>
              <div style={{ fontSize: 14, marginTop: 8, color: "var(--text)" }}>
                Deep metrics, charts, rankings →
              </div>
            </Link>
            <Link href="/research" className="t-card" style={{ textDecoration: "none" }}>
              <div className="t-card-title">Research</div>
              <div style={{ fontSize: 14, marginTop: 8, color: "var(--text)" }}>
                Reports, evidence, history →
              </div>
            </Link>
            <Link href="/assistant" className="t-card" style={{ textDecoration: "none" }}>
              <div className="t-card-title">Ask Insight</div>
              <div style={{ fontSize: 14, marginTop: 8, color: "var(--text)" }}>
                Grounded AI analysis →
              </div>
            </Link>
            <Link href="/alerts" className="t-card" style={{ textDecoration: "none" }}>
              <div className="t-card-title">Alerts</div>
              <div style={{ fontSize: 14, marginTop: 8, color: "var(--text)" }}>
                Anomaly subscriptions →
              </div>
            </Link>
          </div>
        </div>
      </div>

      <footer>
        <div>
          <div className="brand">◎ Insight</div>
          <div>Solana Intelligence Terminal · Evidence-backed</div>
        </div>
        <div>© 2026 · Built for the Solana ecosystem reporting Mission</div>
      </footer>
    </div>
  );
}
