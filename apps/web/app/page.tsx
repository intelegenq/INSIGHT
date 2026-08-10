"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InsightChart, Sparkline } from "../components/InsightChart";
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
}
interface AnalyticsData {
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
  categoryCount: number;
  categoryDistribution: { category: string; count: number }[];
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

function MetricCard({
  label,
  value,
  change,
  sub,
  sparkData,
}: {
  label: string;
  value: string;
  change?: number;
  sub?: string;
  sparkData?: number[];
}) {
  const isUp = (change ?? 0) >= 0;
  const sparkColor = isUp ? "#059669" : "#dc2626";
  return (
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
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          marginTop: 4,
          color: "var(--text)",
        }}
      >
        {value}
      </div>
      {change !== undefined && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            color: isUp ? "var(--green)" : "var(--red)",
            marginTop: 2,
          }}
        >
          {isUp ? "▲" : "▼"} {fmtPct(change)}
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      {sparkData && sparkData.length > 0 && (
        <div style={{ width: 80, height: 36, marginTop: 4 }}>
          <Sparkline data={sparkData} color={sparkColor} height={36} />
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Overview] Solana intelligence terminal — SOL price, ecosystem TVL, top protocols, breaking intelligence, narratives.",
    );
  }, [setPageContext]);

  const [priceData, setPriceData] = useState<SolanaPriceData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, projRes, tlRes, narrRes, anRes] = await Promise.all([
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
      ]);
      if (pRes) setPriceData(pRes);
      setProjects(projRes.projects ?? []);
      setTimeline(tlRes.timeline ?? []);
      setNarratives(narrRes.narratives ?? []);
      if (anRes) setAnalytics(anRes);
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
    .slice(0, 8);
  const catChart =
    analytics?.categoryDistribution
      ?.slice(0, 10)
      .map((c) => ({ label: c.category, value: c.count })) ?? [];

  const W = "var(--max-width)";
  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
  };
  const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: "var(--text)" };

  return (
    <div style={{ background: "var(--linen)", minHeight: "100vh" }}>
      {/* HERO */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "56px 24px 32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            margin: 0,
            maxWidth: 800,
          }}
        >
          Real-time intelligence
          <br />
          for the <em style={{ color: "var(--brown)", fontStyle: "italic" }}>Solana ecosystem.</em>
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
          Comprehensive analytics, breaking intelligence, and evidence-backed research — powered by
          live data from DeFiLlama, CoinGecko, and Solana RPC.
        </p>
      </div>

      {/* METRIC BAR */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard
            label="SOL Price"
            value={current ? `$${current.price.toFixed(2)}` : "—"}
            change={current?.change24h}
            sparkData={priceData?.prices?.slice(-30).map((p) => p.price)}
          />
          <MetricCard
            label="Market Cap"
            value={fmtUsd(current?.marketCap)}
            sub={
              current?.circulatingSupply
                ? `${(current.circulatingSupply / 1e9).toFixed(1)}B SOL`
                : "—"
            }
          />
          <MetricCard
            label="Ecosystem TVL"
            value={fmtUsd(analytics?.totalTvl)}
            sub={`${analytics?.projectCount ?? 0} protocols`}
          />
          <MetricCard label="24h Volume" value={fmtUsd(current?.volume)} sub="Trading volume" />
        </div>
      </div>

      {/* SOL PRICE CHART */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 24px" }}>
        <div style={{ ...cardStyle, padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={sectionTitle}>SOL Price — 30D</div>
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
              color="var(--brown)"
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

      {/* 4-PANEL GRID */}
      <div
        style={{
          maxWidth: W,
          margin: "0 auto",
          padding: "0 24px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {/* Panel 1: Top Projects with logos */}
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={sectionTitle}>Top Protocols</div>
          </div>
          <table className="t-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Protocol</th>
                <th className="right">TVL</th>
              </tr>
            </thead>
            <tbody>
              {topProjects.slice(0, 8).map((p, i) => (
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
                      <Link
                        href={`/projects/${p.id}`}
                        style={{ color: "var(--text)", fontSize: 13 }}
                      >
                        {p.name}
                      </Link>
                    </div>
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {fmtUsd(p.metrics?.tvl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Panel 2: Solana Now */}
        <div style={{ ...cardStyle, padding: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={sectionTitle}>Solana Now</div>
            <Link
              href="/solana-now"
              style={{ fontSize: 12, color: "var(--brown)", fontWeight: 600 }}
            >
              View all →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {timeline.slice(0, 5).map((t, i) => (
              <div
                key={t.id}
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-hover)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.title}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    marginTop: 2,
                  }}
                >
                  <span style={{ color: "var(--brown)" }}>{t.source}</span> · {t.confidence}
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                  padding: 20,
                  textAlign: "center",
                }}
              >
                {loading ? "Loading..." : "No updates yet."}
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Category Distribution */}
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ ...sectionTitle, marginBottom: 12 }}>Category Distribution</div>
          {catChart.length > 0 ? (
            <InsightChart
              data={catChart}
              type="bar"
              color="var(--brown)"
              height={200}
              formatValue={(v) => `${v}`}
            />
          ) : (
            <div
              style={{ color: "var(--text-muted)", fontSize: 13, padding: 20, textAlign: "center" }}
            >
              {loading ? "Loading..." : "No data."}
            </div>
          )}
        </div>

        {/* Panel 4: Narratives */}
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ ...sectionTitle, marginBottom: 12 }}>Active Narratives</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {narratives.slice(0, 6).map((n) => (
              <Link
                href={`/narratives/${n.id}`}
                key={n.id}
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-hover)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                    {n.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      background: n.trend === "up" ? "rgba(5,150,105,0.1)" : "var(--bg-hover)",
                      color: n.trend === "up" ? "var(--green)" : "var(--text-muted)",
                    }}
                  >
                    {n.trend}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
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
          maxWidth: W,
          margin: "32px auto 0",
          padding: "24px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: "var(--brown)" }}>◎ Insight</span> — Solana
          Intelligence Terminal
        </div>
        <div>
          © {new Date().getFullYear()} · Evidence-backed · Source: DeFiLlama, CoinGecko, Solana RPC
        </div>
      </footer>
    </div>
  );
}
