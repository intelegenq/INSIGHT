"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InsightChart } from "../components/InsightChart";
import { ProjectLogo } from "../components/ProjectLogo";
import { useCopilot } from "../components/Copilot";

// ── Types ─────────────────────────────────────────────────────────

interface PricePoint {
  timestamp: string;
  price: number;
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
  classification?: string;
}
interface PulseData {
  asOf: string;
  metrics: unknown[];
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
const HR: React.CSSProperties = { borderTop: "2px solid #3d2e1e", margin: 0 };
const HR_LIGHT: React.CSSProperties = { borderTop: "1px solid var(--border)", margin: 0 };

const sectionHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text)",
};
const srcLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
};

// ── Feed badge ─────────────────────────────────────────────────────

function feedBadge(confidence: string, source: string): { label: string; color: string } {
  const s = source.toLowerCase();
  const c = confidence.toLowerCase();
  if (c.includes("high") || c.includes("breaking"))
    return { label: "BREAKING", color: "var(--red)" };
  if (c.includes("alert") || c.includes("data"))
    return { label: "DATA ALERT", color: "var(--brown)" };
  if (s.includes("coingecko") || s.includes("defillama") || s.includes("solana"))
    return { label: "DATA", color: "var(--brown)" };
  return { label: "NEWS", color: "var(--text-secondary)" };
}

// ── Loading / NoData ──────────────────────────────────────────────

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

  const ecoProjects = projects.filter(
    (p) => !p.classification || p.classification === "solana_ecosystem",
  );
  const topByTvl = [...ecoProjects]
    .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
    .slice(0, 8);

  const liveCount = health?.summary?.healthy ?? 0;
  const totalProviders = health?.summary?.total ?? 0;
  const asOf = pulse?.asOf ?? health?.checkedAt;

  // Build feed from timeline + narratives
  const feedItems: {
    id: string;
    title: string;
    source: string;
    confidence: string;
    time?: string;
  }[] = [...timeline.slice(0, 5).map((t) => ({ ...t }))];
  if (feedItems.length < 5 && narratives.length > 0) {
    for (const n of narratives) {
      if (feedItems.length >= 5) break;
      feedItems.push({
        id: `narr-${n.id}`,
        title: `${n.name}: ${n.note}`,
        source: "Insight Narrative",
        confidence: n.trend === "up" ? "high" : n.trend === "watch" ? "draft" : "medium",
        time: undefined,
      });
    }
  }

  // ── Ticker items ────────────────────────────────────────────────

  const tickerItems = [
    {
      label: "SOL",
      value: current ? `$${current.price.toFixed(2)}` : "\u2014",
      change: current?.change24h,
    },
    { label: "TVL", value: fmtUsd(analytics?.totalTvl), change: undefined },
    { label: "DEX VOL", value: fmtUsd(analytics?.totalVolume), change: undefined },
    {
      label: "PROJECTS",
      value: analytics ? String(analytics.projectCount) : "\u2014",
      change: undefined,
    },
    {
      label: "CATEGORIES",
      value: analytics ? String(analytics.categoryCount) : "\u2014",
      change: undefined,
    },
  ];

  return (
    <div style={{ background: "var(--linen)", minHeight: "100vh" }}>
      {/* ═══ 1. HERO ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "48px 24px 20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                margin: 0,
                maxWidth: 720,
              }}
            >
              Real-time intelligence
              <br />
              for the{" "}
              <em style={{ color: "var(--brown)", fontStyle: "italic" }}>Solana ecosystem.</em>
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                maxWidth: 560,
                marginTop: 12,
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
              paddingBottom: 4,
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: liveCount > 0 ? "var(--green)" : "var(--red)",
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
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px" }}>
        <hr style={HR} />
      </div>

      {/* ═══ 2. LIVE TICKER BAR ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text)",
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >
          {tickerItems.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                borderRight: i < tickerItems.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                }}
              >
                {item.label}
              </span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{item.value}</span>
              {item.change !== undefined && (
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 11,
                    color: item.change >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {item.change >= 0 ? "+" : ""}
                  {item.change.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
        <hr style={HR} />
      </div>

      {/* ═══ 3. SOL MARKET SECTION ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "24px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
          }}
        >
          <div style={sectionHeader}>SOL Market</div>
          <div style={srcLabel}>Source: CoinGecko</div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 200px",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Chart */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {current ? `$${current.price.toFixed(2)}` : "\u2014"}
                {current?.change24h !== undefined && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      color: current.change24h >= 0 ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {fmtPct(current.change24h)}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
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
            </div>
            {loading ? (
              <LoadingBox height={260} />
            ) : priceChart.length > 0 ? (
              <InsightChart
                data={priceChart}
                type="area"
                color="var(--brown)"
                height={260}
                formatValue={(v) => `$${v.toFixed(2)}`}
              />
            ) : (
              <NoDataBox height={260} />
            )}
          </div>

          {/* Stats column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <StatRow label="Price" value={current ? `$${current.price.toFixed(2)}` : "\u2014"} />
            <StatRow
              label="24h"
              value={fmtPct(current?.change24h)}
              valueColor={
                current?.change24h === undefined
                  ? undefined
                  : current.change24h >= 0
                    ? "var(--green)"
                    : "var(--red)"
              }
            />
            <StatRow
              label="7d"
              value={fmtPct(current?.change7d)}
              valueColor={
                current?.change7d === undefined
                  ? undefined
                  : current.change7d >= 0
                    ? "var(--green)"
                    : "var(--red)"
              }
            />
            <StatRow
              label="30d"
              value={fmtPct(current?.change30d)}
              valueColor={
                current?.change30d === undefined
                  ? undefined
                  : current.change30d >= 0
                    ? "var(--green)"
                    : "var(--red)"
              }
            />
            <StatRow label="Mkt Cap" value={fmtUsd(current?.marketCap)} />
            <StatRow label="Volume" value={fmtUsd(current?.volume)} />
            <StatRow
              label="Supply"
              value={
                current?.circulatingSupply
                  ? `${(current.circulatingSupply / 1e9).toFixed(1)}B SOL`
                  : "\u2014"
              }
            />
          </div>
        </div>
      </div>
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px" }}>
        <hr style={HR} />
      </div>

      {/* ═══ 4. ECOSYSTEM MOVEMENT SECTION ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "24px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <div style={sectionHeader}>Ecosystem Movement</div>
          <div style={srcLabel}>Source: DeFiLlama</div>
        </div>
        {loading ? (
          <LoadingBox height={320} />
        ) : topByTvl.length > 0 ? (
          <table className="t-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={thLeft}>#</th>
                <th style={thLeft}>Project</th>
                <th style={thLeft}>Category</th>
                <th style={thRight}>TVL</th>
                <th style={thRight}>24h</th>
                <th style={thRight}>Volume</th>
              </tr>
            </thead>
            <tbody>
              {topByTvl.map((p, i) => (
                <tr key={p.id}>
                  <td style={tdMono}>{i + 1}</td>
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
                      <ProjectLogo src={p.logoUrl} name={p.name} size={18} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        {p.name}
                      </span>
                    </Link>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.category}</td>
                  <td style={{ ...tdMono, textAlign: "right", fontWeight: 600 }}>
                    {fmtUsd(p.metrics?.tvl)}
                  </td>
                  <td
                    style={{
                      ...tdMono,
                      textAlign: "right",
                      color:
                        p.change24h === undefined
                          ? "var(--text-muted)"
                          : p.change24h >= 0
                            ? "var(--green)"
                            : "var(--red)",
                      fontWeight: 600,
                    }}
                  >
                    {p.change24h !== undefined ? fmtPct(p.change24h) : "\u2014"}
                  </td>
                  <td style={{ ...tdMono, textAlign: "right" }}>{fmtUsd(p.metrics?.volume24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <NoDataBox height={320} />
        )}
      </div>
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px" }}>
        <hr style={HR} />
      </div>

      {/* ═══ 5. SOLANA NOW SECTION ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "24px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <div style={sectionHeader}>Solana Now</div>
          <Link href="/solana-now" style={{ fontSize: 11, color: "var(--brown)", fontWeight: 600 }}>
            View all \u2192
          </Link>
        </div>
        {feedItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {feedItems.map((t, i) => {
              const badge = feedBadge(t.confidence, t.source);
              return (
                <div key={t.id}>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: "10px 0",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: badge.color,
                        fontFamily: "var(--font-mono)",
                        minWidth: 70,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {badge.label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--text)",
                          lineHeight: 1.4,
                        }}
                      >
                        {t.title}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                          marginTop: 2,
                        }}
                      >
                        <span style={{ color: "var(--brown)" }}>{t.source}</span>
                        {t.time ? ` \u00b7 ${t.time}` : ""}
                      </div>
                    </div>
                  </div>
                  {i < feedItems.length - 1 && <hr style={HR_LIGHT} />}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            {loading ? "Loading feed\u2026" : "No updates yet."}
          </div>
        )}
      </div>
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px" }}>
        <hr style={HR} />
      </div>

      {/* ═══ 6. RESEARCH ENTRY ═══ */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/research" style={{ textDecoration: "none", display: "block" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                Research
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  marginTop: 8,
                  maxWidth: 560,
                }}
              >
                Explore protocol activity, liquidity, volume, stablecoins and revenue.
              </p>
            </div>
            <span
              style={{
                fontSize: 28,
                color: "var(--brown)",
                fontWeight: 400,
                fontFamily: "var(--font-serif)",
                flexShrink: 0,
              }}
            >
              \u2192
            </span>
          </div>
        </Link>
      </div>
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px" }}>
        <hr style={HR} />
      </div>

      {/* ═══ 7. FOOTER ═══ */}
      <footer
        style={{
          maxWidth: W,
          margin: "0 auto",
          padding: "20px 24px 40px",
          display: "flex",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--brown)" }}>\u25CE Insight</span>
        <span style={{ margin: "0 8px" }}>\u00b7</span>
        Solana Intelligence Terminal
        <span style={{ margin: "0 8px" }}>\u00b7</span>
        Source: DeFiLlama, CoinGecko, Solana RPC
      </footer>
    </div>
  );
}

// ── Table style constants ─────────────────────────────────────────

const thLeft: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  padding: "6px 8px",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
};

const thRight: React.CSSProperties = {
  ...thLeft,
  textAlign: "right",
};

const tdMono: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text)",
  padding: "8px 8px",
};

// ── StatRow helper ─────────────────────────────────────────────────

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "6px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
          color: valueColor ?? "var(--text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
