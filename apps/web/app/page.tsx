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
  change7d?: number;
  change30d?: number;
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
interface HealthProvider {
  id: string;
  status: string;
}

function fmtUsd(v: number | undefined): string {
  if (!v) return "\u2014";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(v: number | undefined): string {
  if (v === undefined || v === null) return "\u2014";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
};

const cardHover: React.CSSProperties = {
  ...card,
  transition: "border-color 0.15s",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text)",
  letterSpacing: "-0.01em",
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const num: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  color: "var(--text)",
  lineHeight: 1.1,
};

function MetricCard({
  label: lbl,
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
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={label}>{lbl}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: 4,
        }}
      >
        <div>
          <div style={num}>{value}</div>
          {change !== undefined && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                color: isUp ? "var(--green)" : "var(--red)",
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
          <div style={{ width: 70, height: 32, flexShrink: 0 }}>
            <Sparkline data={spark} color={isUp ? "#059669" : "#dc2626"} height={32} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext("[Overview] Solana intelligence terminal homepage.");
  }, [setPageContext]);

  const [priceData, setPriceData] = useState<SolanaPriceData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [health, setHealth] = useState<HealthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    try {
      const [pRes, projRes, tlRes, narrRes, anRes, hRes] = await Promise.all([
        fetch(`/api/solana-price?days=${days}`)
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
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = priceData?.current;
  const priceChart =
    priceData?.prices?.map((p) => ({
      label: new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: p.price,
    })) ?? [];
  const sparkPrices = priceData?.prices?.slice(-30).map((p) => p.price) ?? [];
  const ecoProjects = projects.filter(
    (p) => !p.classification || p.classification === "solana_ecosystem",
  );
  const topByTvl = [...ecoProjects]
    .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
    .slice(0, 8);
  const topGainers = [...ecoProjects]
    .filter((p) => p.change24h !== undefined)
    .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))
    .slice(0, 5);
  const catChart =
    analytics?.categoryDistribution
      ?.slice(0, 10)
      .map((c) => ({ label: c.category, value: c.count })) ?? [];
  const liveCount = health.filter((h) => h.status === "healthy").length;

  const W = "var(--max-width)";

  return (
    <div style={{ background: "var(--linen)", minHeight: "100vh" }}>
      {/* HERO */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "48px 24px 24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(32px, 4.5vw, 52px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            margin: 0,
            maxWidth: 700,
          }}
        >
          Real-time intelligence
          <br />
          for the <em style={{ color: "var(--brown)", fontStyle: "italic" }}>Solana ecosystem.</em>
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            maxWidth: 580,
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          Comprehensive analytics, breaking intelligence, and evidence-backed research \u2014
          powered by live data from DeFiLlama, CoinGecko, and Solana RPC.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: liveCount > 0 ? "var(--green)" : "var(--red)",
              animation: "pulse-dot 2s infinite",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: liveCount > 0 ? "var(--green)" : "var(--red)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {liveCount > 0 ? "LIVE" : "DEGRADED"}
          </span>
          {health.map((h) => (
            <span
              key={h.id}
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: h.status === "healthy" ? "var(--green)" : "var(--red)",
              }}
            >
              {h.id}:{h.status}
            </span>
          ))}
        </div>
      </div>

      {/* METRIC BAR */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 20px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
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
          <MetricCard label="24h Volume" value={fmtUsd(current?.volume)} sub="Trading volume" />
          <MetricCard
            label="Categories"
            value={`${analytics?.categoryCount ?? 0}`}
            sub="Ecosystem sectors"
          />
        </div>
      </div>

      {/* SOL PRICE CHART */}
      <div style={{ maxWidth: W, margin: "0 auto", padding: "0 24px 20px" }}>
        <div style={{ ...card, padding: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={sectionTitle}>SOL Price</div>
              <div
                style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              >
                Source: CoinGecko \u00b7 {priceChart.length} pts
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
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
              {current?.change7d !== undefined && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    color: current.change7d >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  7d: {fmtPct(current.change7d)}
                </span>
              )}
            </div>
          </div>
          {priceChart.length > 0 ? (
            <InsightChart
              data={priceChart}
              type="area"
              color="var(--brown)"
              height={240}
              formatValue={(v) => `$${v.toFixed(2)}`}
            />
          ) : (
            <div
              style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}
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
          padding: "0 24px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {/* Top Gainers */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
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
                        width: 28,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      {i + 1}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ProjectLogo src={p.logoUrl} name={p.name} size={18} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                          {p.name}
                        </span>
                      </div>
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
              style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}
            >
              No gainers data.
            </div>
          )}
        </div>

        {/* Top Protocols by TVL */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
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
          <table className="t-table">
            <tbody>
              {topByTvl.slice(0, 6).map((p, i) => (
                <tr key={p.id}>
                  <td
                    style={{
                      width: 28,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                    }}
                  >
                    {i + 1}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ProjectLogo src={p.logoUrl} name={p.name} size={18} />
                      <Link
                        href={`/projects/${p.id}`}
                        style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}
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

        {/* Category Distribution */}
        <div style={{ ...card, padding: 12 }}>
          <div style={{ ...sectionTitle, marginBottom: 8 }}>Category Distribution</div>
          {catChart.length > 0 ? (
            <InsightChart
              data={catChart}
              type="bar"
              color="var(--brown)"
              height={180}
              formatValue={(v) => `${v}`}
            />
          ) : (
            <div
              style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}
            >
              {loading ? "Loading..." : "No data."}
            </div>
          )}
        </div>

        {/* Solana Now */}
        <div style={{ ...card, padding: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={sectionTitle}>Solana Now</div>
            <Link
              href="/solana-now"
              style={{ fontSize: 11, color: "var(--brown)", fontWeight: 600 }}
            >
              View all \u2192
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {timeline.slice(0, 5).map((t, i) => (
              <div
                key={t.id}
                style={{
                  padding: "8px 10px",
                  background: "var(--bg-hover)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}
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
                  <span style={{ color: "var(--brown)" }}>{t.source}</span> \u00b7 {t.confidence}
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                {loading ? "Loading..." : "No updates yet."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK LINKS */}
      <div
        style={{
          maxWidth: W,
          margin: "0 auto",
          padding: "0 24px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
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
            style={{ ...card, padding: "12px 14px", textDecoration: "none", display: "block" }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--brown)" }}>
              {l.label} \u2192
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{l.desc}</div>
          </Link>
        ))}
      </div>

      {/* FOOTER */}
      <footer
        style={{
          maxWidth: W,
          margin: "24px auto 0",
          padding: "20px 24px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
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
