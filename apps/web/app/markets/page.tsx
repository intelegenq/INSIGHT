"use client";

import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";
import { InsightChart } from "../../components/InsightChart";

interface PricePoint {
  timestamp: string;
  price: number;
}
interface MarketCapPoint {
  timestamp: string;
  value: number;
}
interface VolumePoint {
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
  high24h: number;
  low24h: number;
}
interface SolanaPriceData {
  prices: PricePoint[];
  marketCaps: MarketCapPoint[];
  volumes: VolumePoint[];
  current: CurrentMarket | null;
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

export default function MarketsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Markets] User is viewing Solana market data including SOL price chart, market cap, volume, 24h/7d/30d performance, and ecosystem TVL.",
    );
  }, [setPageContext]);

  const [priceData, setPriceData] = useState<SolanaPriceData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [health, setHealth] = useState<HealthProvider[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, aRes, hRes] = await Promise.all([
        fetch(`/api/solana-price?days=${days}`)
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/analytics")
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/health")
          .then((r) => r.json())
          .catch(() => ({ providers: [] })),
      ]);
      if (pRes) setPriceData(pRes);
      if (aRes) setAnalytics(aRes);
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
  const volumeChart =
    priceData?.volumes?.map((v) => ({
      label: new Date(v.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: v.value,
    })) ?? [];
  const categoryChart =
    analytics?.categoryDistribution?.slice(0, 10).map((c) => ({
      label: c.category,
      value: c.count,
    })) ?? [];

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">MARKETS</p>
        <h1 style={{ fontSize: 32 }}>Solana market intelligence</h1>
        <p className="subtitle">SOL price, ecosystem TVL, volume, and data source status</p>
        <div className="timeframe-controls mt-2">
          {[
            { label: "1D", val: 1 },
            { label: "7D", val: 7 },
            { label: "30D", val: 30 },
            { label: "90D", val: 90 },
          ].map((t) => (
            <button
              key={t.val}
              className={`timeframe-btn ${days === t.val ? "active" : ""}`}
              onClick={() => setDays(t.val)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="terminal-main">
        {loading && <div className="t-loading">Loading market data...</div>}

        {!loading && (
          <>
            {/* SOL metrics */}
            <div className="terminal-grid terminal-grid-4 mb-4">
              <div className="metric-card">
                <span className="metric-label">SOL Price</span>
                <span className="metric-value">
                  {current ? `$${current.price.toFixed(2)}` : "—"}
                </span>
                {current?.change24h !== undefined && (
                  <span className={`metric-change ${current.change24h >= 0 ? "up" : "down"}`}>
                    {fmtPct(current.change24h)} 24h
                  </span>
                )}
              </div>
              <div className="metric-card">
                <span className="metric-label">Market Cap</span>
                <span className="metric-value">{fmtUsd(current?.marketCap)}</span>
                <span className="metric-sub">
                  Circulating:{" "}
                  {current?.circulatingSupply
                    ? `${(current.circulatingSupply / 1e9).toFixed(1)}B SOL`
                    : "—"}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">24h Volume</span>
                <span className="metric-value">{fmtUsd(current?.volume)}</span>
                <span className="metric-sub">Trading volume</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Ecosystem TVL</span>
                <span className="metric-value">{fmtUsd(analytics?.totalTvl)}</span>
                <span className="metric-sub">{analytics?.projectCount ?? 0} protocols</span>
              </div>
            </div>

            {/* SOL price chart */}
            <div className="chart-container mb-4">
              <div className="section-header">
                <div>
                  <div className="section-title">SOL Price — {days}D</div>
                  <div className="section-subtitle">
                    Source: CoinGecko · {priceChart.length} data points
                  </div>
                </div>
                <div className="flex gap-2">
                  {current?.change7d !== undefined && (
                    <span className={`metric-change ${current.change7d >= 0 ? "up" : "down"}`}>
                      7d: {fmtPct(current.change7d)}
                    </span>
                  )}
                  {current?.change30d !== undefined && (
                    <span className={`metric-change ${current.change30d >= 0 ? "up" : "down"}`}>
                      30d: {fmtPct(current.change30d)}
                    </span>
                  )}
                </div>
              </div>
              {priceChart.length > 0 ? (
                <InsightChart
                  data={priceChart}
                  type="area"
                  color="var(--accent)"
                  height={280}
                  formatValue={(v) => `$${v.toFixed(2)}`}
                />
              ) : (
                <div className="t-empty">Price data unavailable.</div>
              )}
            </div>

            {/* Volume chart */}
            {volumeChart.length > 0 && (
              <div className="chart-container mb-4">
                <div className="section-header">
                  <div>
                    <div className="section-title">Trading Volume — {days}D</div>
                    <div className="section-subtitle">Source: CoinGecko</div>
                  </div>
                </div>
                <InsightChart
                  data={volumeChart}
                  type="bar"
                  color="var(--violet)"
                  height={200}
                  formatValue={(v) => fmtUsd(v)}
                />
              </div>
            )}

            {/* Category distribution */}
            {categoryChart.length > 0 && (
              <div className="chart-container mb-4">
                <div className="section-header">
                  <div>
                    <div className="section-title">Ecosystem Category Distribution</div>
                    <div className="section-subtitle">
                      {analytics?.categoryCount ?? 0} categories · {analytics?.projectCount ?? 0}{" "}
                      projects
                    </div>
                  </div>
                </div>
                <InsightChart
                  data={categoryChart}
                  type="bar"
                  color="var(--accent)"
                  height={200}
                  formatValue={(v) => `${v}`}
                />
              </div>
            )}

            {/* Data source health */}
            <div className="terminal-section">
              <div className="section-header">
                <div className="section-title">Data Sources</div>
              </div>
              <div className="terminal-grid terminal-grid-4">
                {health.map((h) => (
                  <div key={h.id} className="t-card" style={{ padding: "12px 16px" }}>
                    <div className="flex justify-between items-center">
                      <span className="t-card-title">{h.id}</span>
                      <span
                        className={`t-badge ${h.status === "healthy" ? "green" : h.status === "degraded" ? "yellow" : "red"}`}
                      >
                        {h.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data provenance */}
            <div className="terminal-section">
              <div className="t-card">
                <div className="t-card-title mb-2">Market Data Provenance</div>
                <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  SOL price, market cap, and volume data from CoinGecko free API. Ecosystem TVL from
                  DeFiLlama. ETF flow data and institutional activity are not available via free API
                  — shown as unavailable rather than fabricated. All metrics are evidence-backed and
                  traceable to their source.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
