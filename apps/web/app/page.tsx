"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InsightChart } from "../components/InsightChart";
import { ProjectLogo } from "../components/ProjectLogo";
import { useCopilot } from "../components/Copilot";

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
  high24h: number;
  low24h: number;
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
interface TimelineEntry {
  id: string;
  title: string;
  source: string;
  confidence: string;
}
interface Narrative {
  id: string;
  name: string;
  trend: string;
  note: string;
  change?: string;
}
interface HealthProvider {
  id: string;
  status: string;
}
interface AnalyticsData {
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
  categoryCount: number;
  categoryDistribution: { category: string; count: number }[];
  topByTvl: { name: string; tvl: number; category: string; id: string }[];
}

function fmtUsd(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(v: number | undefined): string {
  if (v === undefined || v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export default function Home() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Overview] Solana intelligence terminal homepage with SOL price chart, market metrics, ecosystem TVL, top protocols, Solana Now feed, and narratives.",
    );
  }, [setPageContext]);

  const [priceData, setPriceData] = useState<SolanaPriceData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [health, setHealth] = useState<HealthProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, projRes, tlRes, narrRes, anRes, hRes] = await Promise.all([
        fetch("/api/solana-price?days=30")
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/projects?classification=solana_ecosystem")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
        fetch("/api/pulse")
          .then((r) => r.json())
          .catch(() => ({ timeline: [] })),
        fetch("/api/narratives")
          .then((r) => r.json())
          .catch(() => ({ narratives: [] })),
        fetch("/api/analytics")
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/health")
          .then((r) => r.json())
          .catch(() => ({ providers: [] })),
      ]);
      if (pRes) setPriceData(pRes);
      setProjects(projRes.projects ?? []);
      setTimeline(tlRes.timeline ?? []);
      setNarratives(narrRes.narratives ?? []);
      if (anRes) setAnalytics(anRes);
      setHealth(hRes.providers ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = priceData?.current;
  const priceChart =
    priceData?.prices?.map((p) => ({
      label: new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: p.price,
    })) ?? [];
  const ecoProjects = projects.filter(
    (p) => !p.classification || p.classification === "solana_ecosystem",
  );
  const topProjects = [...ecoProjects]
    .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
    .slice(0, 10);
  const catChart =
    analytics?.categoryDistribution
      ?.slice(0, 10)
      .map((c) => ({ label: c.category, value: c.count })) ?? [];
  const liveSources = health.filter((h) => h.status === "healthy").length;

  return (
    <div>
      {/* HERO */}
      <div style={{ padding: "48px 24px 24px", maxWidth: "var(--max-width)", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            margin: 0,
          }}
        >
          Real-time intelligence
          <br />
          for the{" "}
          <em style={{ color: "var(--accent-dim)", fontStyle: "italic" }}>Solana ecosystem.</em>
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "var(--text-secondary)",
            maxWidth: 600,
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          Comprehensive analytics, breaking intelligence, and evidence-backed research — all powered
          by live data from Solana RPC, DeFiLlama, CoinGecko, and Helius.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: liveSources > 0 ? "var(--green)" : "var(--red)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: liveSources > 0 ? "var(--green)" : "var(--red)",
                animation: "pulse-dot 2s infinite",
              }}
            />
            {liveSources > 0 ? "LIVE" : "DEGRADED"}
          </span>
          {health.map((h) => (
            <span
              key={h.id}
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color:
                  h.status === "healthy"
                    ? "var(--green)"
                    : h.status === "degraded"
                      ? "var(--warning)"
                      : "var(--red)",
              }}
            >
              {h.id} {h.status}
            </span>
          ))}
        </div>
      </div>

      {/* METRIC BAR */}
      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              SOL Price
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                marginTop: 4,
              }}
            >
              {current ? `$${current.price.toFixed(2)}` : "—"}
            </div>
            {current?.change24h !== undefined && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  color: current.change24h >= 0 ? "var(--green)" : "var(--red)",
                }}
              >
                {current.change24h >= 0 ? "▲" : "▼"} {fmtPct(current.change24h)} 24h
              </div>
            )}
          </div>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              Market Cap
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                marginTop: 4,
              }}
            >
              {fmtUsd(current?.marketCap)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {current?.circulatingSupply
                ? `${(current.circulatingSupply / 1e9).toFixed(1)}B SOL`
                : "—"}
            </div>
          </div>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              Ecosystem TVL
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                marginTop: 4,
              }}
            >
              {fmtUsd(analytics?.totalTvl)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {analytics?.projectCount ?? 0} protocols
            </div>
          </div>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              24h Volume
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                marginTop: 4,
              }}
            >
              {fmtUsd(current?.volume)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Trading volume
            </div>
          </div>
        </div>
      </div>

      {/* SOL PRICE CHART */}
      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 24px 24px" }}>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>SOL Price — 30D</div>
              <div
                style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              >
                Source: CoinGecko · {priceChart.length} data points
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {current?.change7d !== undefined && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    color: current.change7d >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  7d: {fmtPct(current.change7d)}
                </span>
              )}
              {current?.change30d !== undefined && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    color: current.change30d >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  30d: {fmtPct(current.change30d)}
                </span>
              )}
            </div>
          </div>
          {priceChart.length > 0 ? (
            <InsightChart
              data={priceChart}
              type="area"
              color="var(--accent-dim)"
              height={260}
              formatValue={(v) => `$${v.toFixed(2)}`}
            />
          ) : (
            <div
              style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14 }}
            >
              {loading ? "Loading chart..." : "Price data unavailable."}
            </div>
          )}
        </div>
      </div>

      {/* SOLANA NOW + TOP PROJECTS */}
      <div
        style={{
          maxWidth: "var(--max-width)",
          margin: "0 auto",
          padding: "0 24px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        {/* Solana Now */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>Solana Now</div>
            <Link
              href="/solana-now"
              style={{ fontSize: 12, color: "var(--accent-dim)", fontWeight: 600 }}
            >
              View all →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {timeline.slice(0, 6).map((t, i) => (
              <div
                key={t.id}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "14px 16px",
                  display: "flex",
                  gap: 12,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "nowrap",
                    marginTop: 2,
                    background: i === 0 ? "#fef2f2" : i === 1 ? "#fffbeb" : "#faf5ff",
                    color: i === 0 ? "var(--red)" : i === 1 ? "var(--warning)" : "var(--violet)",
                    border: `1px solid ${i === 0 ? "#fecaca" : i === 1 ? "#fde68a" : "#e9d5ff"}`,
                  }}
                >
                  {i === 0 ? "BREAKING" : i === 1 ? "ALERT" : "EVENT"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{t.title}</div>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 4,
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span style={{ color: "var(--accent-dim)" }}>{t.source}</span>
                    <span>·</span>
                    <span>{t.confidence}</span>
                  </div>
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: 32,
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                {loading ? "Loading..." : "No updates yet."}
              </div>
            )}
          </div>
        </div>

        {/* Top Projects with logos */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>Top Protocols by TVL</div>
            <Link
              href="/ecosystem"
              style={{ fontSize: 12, color: "var(--accent-dim)", fontWeight: 600 }}
            >
              All →
            </Link>
          </div>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
            }}
          >
            <table className="t-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Protocol</th>
                  <th className="right">TVL</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {topProjects.slice(0, 10).map((p, i) => (
                  <tr key={p.id}>
                    <td
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                      }}
                    >
                      {i + 1}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ProjectLogo src={p.logoUrl} name={p.name} size={20} />
                        <Link href={`/projects/${p.id}`} style={{ color: "var(--text)" }}>
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td
                      style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12 }}
                    >
                      {fmtUsd(p.metrics?.tvl)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-hover)",
                          color: "var(--text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {p.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CATEGORY CHART + NARRATIVES */}
      <div
        style={{
          maxWidth: "var(--max-width)",
          margin: "0 auto",
          padding: "0 24px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            Category Distribution
          </div>
          {catChart.length > 0 ? (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 20,
              }}
            >
              <InsightChart
                data={catChart}
                type="bar"
                color="var(--accent-dim)"
                height={200}
                formatValue={(v) => `${v}`}
              />
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {loading ? "Loading..." : "No data."}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Active Narratives</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {narratives.slice(0, 6).map((n) => (
              <Link
                href={`/narratives/${n.id}`}
                key={n.id}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "14px 16px",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{n.name}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      background: n.trend === "up" ? "rgba(16,185,129,0.1)" : "var(--bg-hover)",
                      color: n.trend === "up" ? "var(--green)" : "var(--text-muted)",
                    }}
                  >
                    {n.trend}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  {n.note}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer
        style={{
          maxWidth: "var(--max-width)",
          margin: "40px auto 0",
          padding: "24px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>◎ Insight</span> — Solana
          Intelligence Terminal
        </div>
        <div>© {new Date().getFullYear()} · Evidence-backed</div>
      </footer>
    </div>
  );
}
