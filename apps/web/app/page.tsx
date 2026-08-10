"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InsightChart, Sparkline } from "../components/InsightChart";
import { ProjectLogo } from "../components/ProjectLogo";
import { useCopilot } from "../components/Copilot";

// ── Types ─────────────────────────────────────────────────────────

interface PricePoint {
  timestamp: string;
  price: number;
}
interface MarketDataPoint {
  timestamp: string;
  value: number;
}
interface CurrentMarket {
  price: number;
  marketCap: number;
  volume: number;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  circulatingSupply: number;
  high24h?: number;
  low24h?: number;
}
interface SolanaPriceData {
  prices: PricePoint[];
  marketCaps?: MarketDataPoint[];
  volumes?: MarketDataPoint[];
  current: CurrentMarket | null;
}
interface Project {
  id: string;
  name: string;
  category: string;
  metrics: { tvl?: number; volume24h?: number };
  logoUrl?: string;
  symbol?: string;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  classification?: string;
}
interface PulseMetric {
  id: string;
  label: string;
  value: string;
  caption: string;
  variant?: "default" | "violet";
}
interface PulseData {
  asOf: string;
  metrics: PulseMetric[];
}
interface TimelineEntry {
  id: string;
  time?: string;
  title: string;
  source: string;
  confidence: string;
}
interface Narrative {
  id: string;
  name: string;
  trend: "up" | "down" | "flat" | "watch";
  change?: string;
  note: string;
}
interface AnalyticsData {
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
  categoryCount: number;
  categoryDistribution: { category: string; count: number }[];
  topByTvl: { id: string; name: string; tvl: number; volume24h: number; category: string }[];
}
interface HealthProvider {
  id: string;
  name: string;
  available: boolean;
  status: string;
  note?: string;
}
interface HealthData {
  status: string;
  checkedAt: string;
  providers: HealthProvider[];
  summary: { total: number; healthy: number; unavailable: number };
}

// ── Formatters ────────────────────────────────────────────────────

function fmtUsd(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "\u2014";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "\u2014";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function fmtNum(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "\u2014";
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}
function fmtTime(ts: string | undefined): string {
  if (!ts) return "\u2014";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return (
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC"
  );
}

// ── Style constants ───────────────────────────────────────────────

const W = "var(--max-width)";

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text)",
  letterSpacing: "-0.01em",
};

const srcLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
};

const lbl: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const monoVal: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  color: "var(--text)",
  lineHeight: 1.1,
};

// ── Compact metric card ───────────────────────────────────────────

function MetricCard({
  label: lblText,
  value,
  change,
  sub,
  spark,
}: {
  label: string;
  value: string;
  change?: number;
  sub?: string;
  spark?: number[];
}) {
  const isUp = (change ?? 0) >= 0;
  return (
    <div
      style={{ ...card, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div style={lbl}>{lblText}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={monoVal}>{value}</div>
          {change !== undefined && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                color: isUp ? "var(--green)" : "var(--red)",
                marginTop: 1,
              }}
            >
              {isUp ? "\u25B2" : "\u25BC"} {fmtPct(change)}
            </div>
          )}
          {sub && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>
          )}
        </div>
        {spark && spark.length > 1 && (
          <div style={{ width: 64, height: 28, flexShrink: 0 }}>
            <Sparkline data={spark} color={isUp ? "#059669" : "#dc2626"} height={28} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Feed badge picker ─────────────────────────────────────────────

function feedBadgeClass(confidence: string, source: string): { cls: string; label: string } {
  const s = source.toLowerCase();
  const c = confidence.toLowerCase();
  if (c.includes("high") || c.includes("breaking")) return { cls: "breaking", label: "BREAKING" };
  if (c.includes("alert") || c.includes("data")) return { cls: "alert", label: "DATA ALERT" };
  if (s.includes("coingecko") || s.includes("defillama") || s.includes("solana"))
    return { cls: "new", label: "DATA" };
  if (c.includes("draft") || c.includes("illustrative"))
    return { cls: "developing", label: "NEWS" };
  return { cls: "event", label: "NEWS" };
}

// ── Loading placeholder ──────────────────────────────────────────

function LoadingBox({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height,
        color: "var(--text-muted)",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
      }}
    >
      Loading\u2026
    </div>
  );
}

function NoDataBox({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height,
        color: "var(--text-muted)",
        fontSize: 12,
      }}
    >
      Data unavailable
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function Home() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext("[Overview] Solana intelligence terminal homepage.");
  }, [setPageContext]);

  const [priceData, setPriceData] = useState<SolanaPriceData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    try {
      const [pRes, projRes, pulseRes, narrRes, anRes, hRes] = await Promise.all([
        fetch(`/api/solana-price?days=${days}`)
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/projects?classification=solana_ecosystem")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
        fetch("/api/pulse")
          .then((r) => r.json())
          .catch(() => ({ pulse: null, timeline: [] })),
        fetch("/api/narratives")
          .then((r) => r.json())
          .catch(() => ({ narratives: [] })),
        fetch("/api/analytics")
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/health")
          .then((r) => r.json())
          .catch(() => null),
      ]);
      if (pRes) setPriceData(pRes);
      setProjects(projRes.projects ?? []);
      if (pulseRes.pulse) setPulse(pulseRes.pulse);
      setTimeline(pulseRes.timeline ?? []);
      setNarratives(narrRes.narratives ?? []);
      if (anRes) setAnalytics(anRes);
      if (hRes) setHealth(hRes);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived data ────────────────────────────────────────────────

  const current = priceData?.current;
  const priceChart =
    priceData?.prices?.map((p) => ({
      label: new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: p.price,
    })) ?? [];
  const sparkPrices = priceData?.prices?.slice(-30).map((p) => p.price) ?? [];
  const volumeChart =
    priceData?.volumes?.map((v) => ({
      label: new Date(v.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: v.value,
    })) ?? [];
  const marketCapChart =
    priceData?.marketCaps?.map((m) => ({
      label: new Date(m.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: m.value,
    })) ?? [];

  const ecoProjects = projects.filter(
    (p) => !p.classification || p.classification === "solana_ecosystem",
  );
  const topByTvl = [...ecoProjects]
    .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
    .slice(0, 8);
  const topGainers = [...ecoProjects]
    .filter((p) => p.change24h !== undefined)
    .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))
    .slice(0, 6);

  const catChart =
    analytics?.categoryDistribution
      ?.slice(0, 10)
      .map((c) => ({ label: c.category, value: c.count })) ?? [];

  // Compute TPS proxy: total volume / project count (not real TPS but a derived metric)
  // Fees: derive from volume * 0.1% as rough estimate
  const tpsProxy = analytics ? Math.round((analytics.totalVolume / 86400) * 100) / 100 : undefined;
  const feesProxy = current?.volume ? current.volume * 0.001 : undefined;
  const activeValidators = 1900; // Solana mainnet known constant
  const liveCount = health?.summary?.healthy ?? 0;
  const totalProviders = health?.summary?.total ?? 0;
  const asOf = pulse?.asOf ?? health?.checkedAt;

  // Build a combined feed from timeline + narratives
  const feedItems: {
    id: string;
    title: string;
    source: string;
    confidence: string;
    time?: string;
  }[] = [...timeline.slice(0, 4).map((t) => ({ ...t }))];
  if (feedItems.length < 6 && narratives.length > 0) {
    for (const n of narratives) {
      if (feedItems.length >= 6) break;
      feedItems.push({
        id: `narr-${n.id}`,
        title: `${n.name}: ${n.note}`,
        source: "Insight Narrative",
        confidence: n.trend === "up" ? "high" : n.trend === "watch" ? "draft" : "medium",
        time: undefined,
      });
    }
  }

  return (
    <div style={{ background: "var(--linen)", minHeight: "100vh" }}>
      {/* ═══ 1. HERO ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "40px 24px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 700,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                margin: 0,
                maxWidth: 680,
              }}
            >
              Real-time intelligence for the{" "}
              <em style={{ color: "var(--brown)", fontStyle: "italic" }}>Solana ecosystem.</em>
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                maxWidth: 560,
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Comprehensive analytics, breaking intelligence, and evidence-backed research \u2014
              powered by live data from DeFiLlama, CoinGecko, and Solana RPC.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: liveCount > 0 ? "var(--green)" : "var(--red)",
                  animation: "pulse-dot 2s infinite",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: liveCount > 0 ? "var(--green)" : "var(--red)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {liveCount > 0 ? "LIVE" : "DEGRADED"}
              </span>
            </div>
            {asOf && (
              <span
                style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              >
                Updated {fmtTime(asOf)}
              </span>
            )}
            {totalProviders > 0 && (
              <span
                style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              >
                {liveCount}/{totalProviders} providers
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 2. METRIC STRIP ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 16px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
            gap: 8,
          }}
        >
          <MetricCard
            label="SOL Price"
            value={current ? `$${current.price.toFixed(2)}` : "\u2014"}
            change={current?.change24h}
            spark={sparkPrices}
          />
          <MetricCard
            label="Market Cap"
            value={fmtUsd(current?.marketCap)}
            change={current?.change30d}
            sub={
              current?.circulatingSupply
                ? `${(current.circulatingSupply / 1e9).toFixed(1)}B SOL`
                : undefined
            }
          />
          <MetricCard
            label="Ecosystem TVL"
            value={fmtUsd(analytics?.totalTvl)}
            sub={`${analytics?.projectCount ?? 0} protocols`}
          />
          <MetricCard
            label="DEX Volume 24h"
            value={fmtUsd(analytics?.totalVolume)}
            sub="Aggregated"
          />
          <MetricCard
            label="TPS (proxy)"
            value={tpsProxy !== undefined ? fmtNum(tpsProxy) : "\u2014"}
            sub="Vol / sec"
          />
          <MetricCard label="Est. Fees 24h" value={fmtUsd(feesProxy)} sub="0.1% of vol" />
          <MetricCard label="Validators" value={String(activeValidators)} sub="Mainnet active" />
        </div>
      </div>

      {/* ═══ 3. SOL MARKET SECTION ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 16px" }}>
        <div style={{ ...card, padding: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <div style={sectionTitle}>SOL Price</div>
              <div style={srcLabel}>Source: CoinGecko \u00b7 {priceChart.length} data points</div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                }}
              >
                {[1, 7, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    style={{
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      background: days === d ? "var(--brown)" : "transparent",
                      color: days === d ? "#fff" : "var(--text-muted)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {d === 1 ? "1D" : d === 7 ? "7D" : d === 30 ? "30D" : "90D"}
                  </button>
                ))}
              </div>
              {current && (
                <div style={{ display: "flex", gap: 10 }}>
                  {current.change24h !== undefined && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        color: current.change24h >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      24h: {fmtPct(current.change24h)}
                    </span>
                  )}
                  {current.change7d !== undefined && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        color: current.change7d >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      7d: {fmtPct(current.change7d)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {loading ? (
            <LoadingBox height={240} />
          ) : priceChart.length > 0 ? (
            <InsightChart
              data={priceChart}
              type="area"
              color="var(--brown)"
              height={240}
              formatValue={(v) => `$${v.toFixed(2)}`}
            />
          ) : (
            <NoDataBox height={240} />
          )}
        </div>

        {/* 3 sub-charts */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 10,
            marginTop: 10,
          }}
        >
          <div style={{ ...card, padding: 12 }}>
            <div style={{ ...sectionTitle, fontSize: 12, marginBottom: 6 }}>Volume</div>
            <div style={srcLabel}>CoinGecko \u00b7 24h bars</div>
            {loading ? (
              <LoadingBox height={130} />
            ) : volumeChart.length > 0 ? (
              <InsightChart
                data={volumeChart}
                type="bar"
                color="#2563eb"
                height={130}
                formatValue={(v) => fmtUsd(v)}
              />
            ) : (
              <NoDataBox height={130} />
            )}
          </div>
          <div style={{ ...card, padding: 12 }}>
            <div style={{ ...sectionTitle, fontSize: 12, marginBottom: 6 }}>Market Cap</div>
            <div style={srcLabel}>CoinGecko \u00b7 {days}D</div>
            {loading ? (
              <LoadingBox height={130} />
            ) : marketCapChart.length > 0 ? (
              <InsightChart
                data={marketCapChart}
                type="area"
                color="var(--brown)"
                height={130}
                formatValue={(v) => fmtUsd(v)}
              />
            ) : (
              <NoDataBox height={130} />
            )}
          </div>
          <div style={{ ...card, padding: 12 }}>
            <div style={{ ...sectionTitle, fontSize: 12, marginBottom: 6 }}>Price Performance</div>
            <div style={srcLabel}>CoinGecko</div>
            {loading ? (
              <LoadingBox height={130} />
            ) : current ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
                <PerfRow label="24h" change={current.change24h} />
                <PerfRow label="7d" change={current.change7d} />
                <PerfRow label="30d" change={current.change30d} />
                {current.high24h !== undefined && current.low24h !== undefined && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-muted)",
                      borderTop: "1px solid var(--border)",
                      paddingTop: 6,
                      marginTop: 2,
                    }}
                  >
                    <span>H: ${current.high24h.toFixed(2)}</span>
                    <span>L: ${current.low24h.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : (
              <NoDataBox height={130} />
            )}
          </div>
        </div>
      </div>

      {/* ═══ 4. ECOSYSTEM SECTION ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={sectionTitle}>Ecosystem Overview</div>
          <div style={srcLabel}>Source: DeFiLlama</div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 10,
          }}
        >
          <div style={{ ...card, padding: 12 }}>
            <div style={{ ...sectionTitle, fontSize: 12, marginBottom: 6 }}>TVL Distribution</div>
            {topByTvl.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {topByTvl.slice(0, 6).map((p) => {
                  const total = topByTvl.reduce((s, x) => s + (x.metrics?.tvl ?? 0), 0) || 1;
                  const pct = ((p.metrics?.tvl ?? 0) / total) * 100;
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          width: 60,
                          fontSize: 11,
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "var(--bg-hover)",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: "var(--brown)",
                            borderRadius: 2,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-muted)",
                          width: 50,
                          textAlign: "right",
                        }}
                      >
                        {fmtUsd(p.metrics?.tvl)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : loading ? (
              <LoadingBox height={130} />
            ) : (
              <NoDataBox height={130} />
            )}
          </div>
          <div style={{ ...card, padding: 12 }}>
            <div style={{ ...sectionTitle, fontSize: 12, marginBottom: 6 }}>DEX Volume</div>
            <div style={srcLabel}>By protocol 24h</div>
            {topByTvl.filter((p) => p.metrics?.volume24h).length > 0 ? (
              <InsightChart
                data={topByTvl
                  .filter((p) => p.metrics?.volume24h)
                  .slice(0, 8)
                  .map((p) => ({ label: p.name, value: p.metrics?.volume24h ?? 0 }))}
                type="bar"
                color="#2563eb"
                height={130}
                formatValue={(v) => fmtUsd(v)}
              />
            ) : loading ? (
              <LoadingBox height={130} />
            ) : (
              <NoDataBox height={130} />
            )}
          </div>
          <div style={{ ...card, padding: 12 }}>
            <div style={{ ...sectionTitle, fontSize: 12, marginBottom: 6 }}>
              Category Distribution
            </div>
            <div style={srcLabel}>{analytics?.categoryCount ?? 0} categories</div>
            {catChart.length > 0 ? (
              <InsightChart
                data={catChart}
                type="bar"
                color="var(--brown)"
                height={130}
                formatValue={(v) => String(v)}
              />
            ) : loading ? (
              <LoadingBox height={130} />
            ) : (
              <NoDataBox height={130} />
            )}
          </div>
        </div>
      </div>

      {/* ═══ 5. SOLANA NOW SECTION ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={sectionTitle}>Solana Now</div>
          <Link href="/solana-now" style={{ fontSize: 11, color: "var(--brown)", fontWeight: 600 }}>
            View all \u2192
          </Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {feedItems.length > 0 ? (
            feedItems.slice(0, 6).map((t) => {
              const badge = feedBadgeClass(t.confidence, t.source);
              return (
                <div
                  key={t.id}
                  style={{
                    ...card,
                    padding: "8px 12px",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    transition: "border-color 0.15s",
                  }}
                >
                  <span className={`feed-badge ${badge.cls}`} style={{ marginTop: 2 }}>
                    {badge.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text)",
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.title}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        marginTop: 1,
                      }}
                    >
                      <span style={{ color: "var(--brown)" }}>{t.source}</span>
                      {t.time ? ` \u00b7 ${t.time}` : ""}
                      {" \u00b7 "}
                      {t.confidence}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div
              style={{
                ...card,
                padding: 20,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 12,
              }}
            >
              {loading ? "Loading feed\u2026" : "No updates yet."}
            </div>
          )}
        </div>
      </div>

      {/* ═══ 6. TOP MOVERS ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 16px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 10,
          }}
        >
          {/* Top Gainers 24h */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={sectionTitle}>Top Gainers 24h</div>
              <Link
                href="/analytics"
                style={{ fontSize: 11, color: "var(--brown)", fontWeight: 600 }}
              >
                View all \u2192
              </Link>
            </div>
            {topGainers.length > 0 ? (
              <table className="t-table">
                <tbody>
                  {topGainers.map((p, i) => (
                    <tr key={p.id}>
                      <td
                        style={{
                          width: 24,
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                      >
                        {i + 1}
                      </td>
                      <td>
                        <Link
                          href={`/projects/${p.id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            textDecoration: "none",
                          }}
                        >
                          <ProjectLogo src={p.logoUrl} name={p.name} size={20} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                            {p.name}
                          </span>
                        </Link>
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--green)",
                        }}
                      >
                        {p.change24h !== undefined ? `+${p.change24h.toFixed(1)}%` : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                {loading ? "Loading\u2026" : "Data unavailable"}
              </div>
            )}
          </div>

          {/* Top by TVL */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={sectionTitle}>Top by TVL</div>
              <Link
                href="/ecosystem"
                style={{ fontSize: 11, color: "var(--brown)", fontWeight: 600 }}
              >
                View all \u2192
              </Link>
            </div>
            {topByTvl.length > 0 ? (
              <table className="t-table">
                <tbody>
                  {topByTvl.slice(0, 6).map((p, i) => (
                    <tr key={p.id}>
                      <td
                        style={{
                          width: 24,
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                      >
                        {i + 1}
                      </td>
                      <td>
                        <Link
                          href={`/projects/${p.id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            textDecoration: "none",
                          }}
                        >
                          <ProjectLogo src={p.logoUrl} name={p.name} size={20} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                            {p.name}
                          </span>
                        </Link>
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "var(--text)",
                        }}
                      >
                        {fmtUsd(p.metrics?.tvl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                {loading ? "Loading\u2026" : "Data unavailable"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 7. QUICK LINKS ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 16px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
          }}
        >
          {[
            { href: "/markets", label: "Markets", desc: "SOL price & market data" },
            { href: "/analytics", label: "Analytics", desc: "Charts & rankings" },
            { href: "/ecosystem", label: "Ecosystem", desc: "Project universe" },
            { href: "/network", label: "Network", desc: "Validator & RPC" },
            { href: "/solana-now", label: "Solana Now", desc: "Breaking intelligence" },
            { href: "/research", label: "Research", desc: "Reports & evidence" },
            { href: "/assistant", label: "Ask Insight", desc: "AI copilot" },
            { href: "/alerts", label: "Alerts", desc: "Anomaly detection" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                ...card,
                padding: "10px 12px",
                textDecoration: "none",
                display: "block",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brown)" }}>
                {l.label} \u2192
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{l.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer
        style={{
          maxWidth: W,
          margin: "16px auto 0",
          padding: "16px 24px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: "var(--brown)" }}>\u25CE Insight</span> \u2014
          Solana Intelligence Terminal
        </div>
        <div>
          \u00A9 {new Date().getFullYear()} \u00b7 Evidence-backed \u00b7 DeFiLlama \u00b7 CoinGecko
          \u00b7 Solana RPC
        </div>
      </footer>
    </div>
  );
}

// ── Performance row helper ─────────────────────────────────────────

function PerfRow({ label, change }: { label: string; change?: number }) {
  const isUp = (change ?? 0) >= 0;
  const has = change !== undefined;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "2px 0",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
          color: has ? (isUp ? "var(--green)" : "var(--red)") : "var(--text-muted)",
        }}
      >
        {has ? fmtPct(change) : "\u2014"}
      </span>
    </div>
  );
}
