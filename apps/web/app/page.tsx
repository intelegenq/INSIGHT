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
interface CurrentMarket {
  price: number;
  marketCap: number;
  volume: number;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  circulatingSupply: number;
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
  change24h?: number;
  classification?: string;
}
interface Article {
  title: string;
  category: string;
  author: string;
  date: string;
  summary: string;
  url: string;
}
interface SocialPost {
  author: string;
  handle: string;
  text: string;
  url: string;
  date: string;
  source: string;
}
interface NetworkMetrics {
  rpc: {
    epoch: {
      epoch: number;
      slotIndex: number;
      slotsInEpoch: number;
      blockHeight: number;
      transactionCount: number;
      progress: number;
    } | null;
    validators: {
      active: number;
      delinquent: number;
      total: number;
      delinquencyRate: number;
      totalStake: number;
      avgCommission: number;
    } | null;
    tps: {
      current: number;
      avgSlotTime: number;
      history: { slot: number; tps: number; slotTime: number }[];
    } | null;
    inflation: { total: number; validator: number; foundation: number } | null;
    supply: { total: number; circulating: number; nonCirculating: number } | null;
    clusterNodes: number | null;
    medianFee: {
      medianTotalFee: number;
      avgLamports: number;
      samples: number;
    } | null;
  };
  stablecoins: {
    totalSupply: number;
    history: { date: number; total: number }[];
  } | null;
  dexVolume: {
    total24h: number;
    total7d: number;
    total30d: number;
    protocols: { name: string; volume24h: number }[];
  } | null;
  feesRevenue: {
    total24hFees: number;
    total7dFees: number;
    total30dFees: number;
    protocols: { name: string; fees24h: number }[];
  } | null;
}

// ── Formatters ────────────────────────────────────────────────────

function fmtUsd(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function fmtNum(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US");
}
function fmtTimeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function fmtDate(ts: string | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Style constants ───────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const monoLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
};

const monoValue: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  fontFamily: "var(--font-mono)",
  color: "var(--text)",
  letterSpacing: "-0.02em",
};

// ── Main component ────────────────────────────────────────────────

export default function Home() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext("[Overview] Solana intelligence terminal homepage.");
  }, [setPageContext]);

  const [priceData, setPriceData] = useState<SolanaPriceData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [news, setNews] = useState<Article[]>([]);
  const [social, setSocial] = useState<SocialPost[]>([]);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const [pRes, projRes, newsRes, socialRes, netRes] = await Promise.all([
        fetch(`/api/solana-price?days=${days}`)
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/projects?classification=solana_ecosystem")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
        fetch("/api/news")
          .then((r) => r.json())
          .catch(() => ({ articles: [] })),
        fetch("/api/social")
          .then((r) => r.json())
          .catch(() => ({ posts: [] })),
        fetch("/api/network-metrics")
          .then((r) => r.json())
          .catch(() => null),
      ]);
      if (pRes) setPriceData(pRes);
      setProjects(projRes.projects ?? []);
      setNews(newsRes.articles ?? []);
      setSocial(socialRes.posts ?? []);
      if (netRes) setNetworkMetrics(netRes);
      setLastUpdated(new Date().toISOString());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived data ─────────────────────────────────────────────────

  const current = priceData?.current;
  const priceChart =
    priceData?.prices?.map((p) => ({
      label: new Date(p.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: p.price,
    })) ?? [];

  const tpsSparkline = networkMetrics?.rpc?.tps?.history?.map((h) => h.tps) ?? [];

  // Top 5 protocols by TVL — exclude the chain-level "Solana" entry (the L1 itself)
  const topProjects = [...projects]
    .filter(
      (p) => p.name.toLowerCase() !== "solana" && !p.id?.toLowerCase().startsWith("solana-"),
    )
    .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
    .slice(0, 5);

  // ── Metric strip items ──────────────────────────────────────────

  const metrics = [
    {
      label: "SOL Price",
      value: current ? `$${current.price.toFixed(2)}` : "—",
      delta: current?.change24h,
    },
    {
      label: "Market Cap",
      value: fmtUsd(current?.marketCap),
      delta: undefined,
    },
    {
      label: "TVL",
      value: fmtUsd(projects.reduce((s, p) => s + (p.metrics?.tvl ?? 0), 0)),
      delta: undefined,
    },
    {
      label: "DEX Vol",
      value: fmtUsd(networkMetrics?.dexVolume?.total24h),
      delta: undefined,
    },
    {
      label: "TPS",
      value: networkMetrics?.rpc?.tps ? fmtNum(Math.round(networkMetrics.rpc.tps.current)) : "—",
      delta: undefined,
    },
    {
      label: "Stablecoins",
      value: fmtUsd(networkMetrics?.stablecoins?.totalSupply),
      delta: undefined,
    },
  ];

  // ── Network summary string ──────────────────────────────────────

  const netSummary = networkMetrics?.rpc;
  const summaryParts: string[] = [];
  if (netSummary?.tps) {
    summaryParts.push(`TPS ${fmtNum(Math.round(netSummary.tps.current))}`);
  }
  if (netSummary?.tps) {
    summaryParts.push(`Slot ${netSummary.tps.avgSlotTime.toFixed(2)}s`);
  }
  if (netSummary?.epoch) {
    summaryParts.push(`Epoch ${netSummary.epoch.progress.toFixed(1)}%`);
  }
  if (netSummary?.validators) {
    summaryParts.push(
      `Validators ${netSummary.validators.active}/${netSummary.validators.delinquent}`,
    );
  }

  return (
    <div className="main-content">
      <div style={{ maxWidth: "none", margin: 0, padding: "32px 24px" }}>
        {/* ═══ 1. HERO ═══ */}
        <div style={{ marginBottom: 48 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "var(--text)",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            Solana Intelligence Terminal
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--green)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {loading ? "Loading..." : `LIVE · last updated ${fmtTimeAgo(lastUpdated)}`}
            </span>
          </div>
        </div>

        {/* ═══ 2. METRIC STRIP ═══ */}
        <div
          style={{
            display: "flex",
            gap: 48,
            flexWrap: "wrap",
            paddingBottom: 48,
            borderBottom: "1px solid var(--border)",
          }}
        >
          {metrics.map((m) => (
            <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={monoLabel}>{m.label}</span>
              <span style={monoValue}>{loading ? "..." : m.value}</span>
              {m.delta !== undefined && (
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    color: m.delta >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {fmtPct(m.delta)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* ═══ 3. SOL PRICE CHART ═══ */}
        <div style={{ marginTop: 48, marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span style={sectionTitle}>SOL Price</span>
            <div style={{ display: "flex", gap: 2 }}>
              {[1, 7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    background: days === d ? "var(--accent)" : "transparent",
                    color: days === d ? "#fff" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                  }}
                >
                  {d === 1 ? "1D" : d === 7 ? "7D" : d === 30 ? "30D" : "90D"}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div
              style={{
                height: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            >
              Loading...
            </div>
          ) : priceChart.length > 0 ? (
            <InsightChart
              data={priceChart}
              type="area"
              color="var(--accent)"
              height={300}
              formatValue={(v) => `$${v.toFixed(2)}`}
            />
          ) : (
            <div
              style={{
                height: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: 12,
              }}
            >
              Data unavailable
            </div>
          )}
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              marginTop: 8,
            }}
          >
            Source: CoinGecko
          </div>
        </div>

        {/* ═══ 4. NETWORK SUMMARY ═══ */}
        <div
          style={{
            marginTop: 48,
            marginBottom: 48,
            paddingBottom: 48,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ ...sectionTitle, display: "block", marginBottom: 16 }}>
            Network Summary
          </span>
          {loading ? (
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading...</span>
          ) : summaryParts.length > 0 ? (
            <div
              style={{
                fontSize: 15,
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                lineHeight: 1.8,
              }}
            >
              {summaryParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: "var(--text-muted)", margin: "0 8px" }}>·</span>}
                  <span style={{ color: "var(--text-muted)" }}>{part.split(" ")[0]}</span>{" "}
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>
                    {part.split(" ").slice(1).join(" ")}
                  </span>
                </span>
              ))}
              {tpsSparkline.length > 0 && (
                <div style={{ marginTop: 16, maxWidth: 200 }}>
                  <Sparkline data={tpsSparkline} color="var(--accent)" height={32} />
                </div>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Data unavailable</span>
          )}
        </div>

        {/* ═══ 5. TOP 5 PROTOCOLS ═══ */}
        <div
          style={{
            marginTop: 48,
            marginBottom: 48,
            paddingBottom: 48,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ ...sectionTitle, display: "block", marginBottom: 16 }}>
            Top Protocols by TVL
          </span>
          {loading ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading...</div>
          ) : topProjects.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Name</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>TVL</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>24h</th>
                </tr>
              </thead>
              <tbody>
                {topProjects.map((p, i) => (
                  <tr key={p.id}>
                    <td style={tdMonoStyle}>{i + 1}</td>
                    <td style={{ padding: "10px 0" }}>
                      <Link
                        href={`/projects/${p.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textDecoration: "none",
                        }}
                      >
                        <ProjectLogo src={p.logoUrl} name={p.name} size={20} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                          {p.name}
                        </span>
                      </Link>
                    </td>
                    <td style={{ ...tdMonoStyle, textAlign: "right", fontWeight: 600 }}>
                      {fmtUsd(p.metrics?.tvl)}
                    </td>
                    <td
                      style={{
                        ...tdMonoStyle,
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
                      {p.change24h !== undefined ? fmtPct(p.change24h) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Data unavailable</div>
          )}
        </div>

        {/* ═══ 6. LATEST NEWS ═══ */}
        <div
          style={{
            marginTop: 48,
            marginBottom: 48,
            paddingBottom: 48,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ ...sectionTitle, display: "block", marginBottom: 16 }}>Latest News</span>
          {loading ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading...</div>
          ) : news.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {news.slice(0, 3).map((a) => (
                <div key={a.url} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text)",
                      textDecoration: "none",
                      lineHeight: 1.4,
                    }}
                  >
                    {a.title}
                  </a>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "var(--radius)",
                        background: "var(--bg-elevated)",
                        color: "var(--text-secondary)",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {a.category}
                    </span>
                    <span>{a.author}</span>
                    <span>·</span>
                    <span>{fmtDate(a.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Data unavailable</div>
          )}
        </div>

        {/* ═══ 6b. SOCIAL / X FEED ═══ */}
        <div
          style={{
            marginTop: 48,
            paddingBottom: 48,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ ...sectionTitle, display: "block", marginBottom: 16 }}>
            On X — Solana Ecosystem
          </span>
          {loading ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading...</div>
          ) : social.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {social.slice(0, 6).map((post) => (
                <a
                  key={post.url}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "var(--radius)",
                        background: "var(--bg-elevated)",
                        color: "var(--text-secondary)",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      𝕏
                    </span>
                    <span style={{ color: "var(--text)", fontWeight: 500 }}>@{post.handle}</span>
                    <span>·</span>
                    <span>{fmtDate(post.date)}</span>
                  </div>
                  <span style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {post.text.length > 220 ? `${post.text.slice(0, 220)}…` : post.text}
                  </span>
                </a>
              ))}
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Source: X (via Nitter) · public posts
              </span>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              X feed unavailable right now.
            </div>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div
          style={{
            marginTop: 64,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "center",
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Insight · Solana Intelligence Terminal · DeFiLlama, CoinGecko, Solana RPC
        </div>
      </div>
    </div>
  );
}

// ── Table style constants ──────────────────────────────────────────

const thStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  padding: "8px 0",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
};

const tdMonoStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  color: "var(--text)",
  padding: "10px 0",
};
