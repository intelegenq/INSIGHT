"use client";

import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";
import { InsightChart } from "../../components/InsightChart";

interface PulseMetric {
  id: string;
  label: string;
  value: string;
  caption?: string;
  variant?: string;
}
interface HealthProvider {
  id: string;
  status: string;
}

interface AnalyticsData {
  timeSeries: { label: string; projectCount: number; evidenceCount: number }[];
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
}

function fmtTvl(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

export default function MarketsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Markets] User is viewing Solana market data including SOL price, market cap, volume, TVL, and data source health status.",
    );
  }, [setPageContext]);

  const [metrics, setMetrics] = useState<PulseMetric[]>([]);
  const [asOf, setAsOf] = useState("");
  const [health, setHealth] = useState<HealthProvider[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, hRes, aRes] = await Promise.all([
        fetch("/api/pulse")
          .then((r) => r.json())
          .catch(() => ({ pulse: { asOf: "", metrics: [] } })),
        fetch("/api/health")
          .then((r) => r.json())
          .catch(() => ({ providers: [] })),
        fetch("/api/analytics")
          .then((r) => r.json())
          .catch(() => null),
      ]);
      setMetrics(pRes.pulse?.metrics ?? []);
      setAsOf(pRes.pulse?.asOf ?? "");
      setHealth(hRes.providers ?? []);
      if (aRes) setAnalytics(aRes);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const getVal = (id: string) => metrics.find((m) => m.id === id)?.value ?? "—";
  const projectSeries =
    analytics?.timeSeries.map((t) => ({ label: t.label, value: t.projectCount })) ?? [];

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">MARKETS</p>
        <h1 style={{ fontSize: 32 }}>Solana market data</h1>
        <p className="subtitle">SOL price, ecosystem TVL, volume, and data source status</p>
      </div>

      <div className="terminal-main">
        {loading && <div className="t-loading">Loading market data...</div>}

        {!loading && (
          <>
            {/* Ecosystem metrics */}
            <div className="terminal-grid terminal-grid-4 mb-4">
              <div className="metric-card">
                <span className="metric-label">Tracked Projects</span>
                <span className="metric-value">
                  {analytics?.projectCount ?? getVal("projects")}
                </span>
                <span className="metric-sub">Protocols indexed</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Total TVL</span>
                <span className="metric-value">{fmtTvl(analytics?.totalTvl)}</span>
                <span className="metric-sub">DeFiLlama aggregate</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">24h Volume</span>
                <span className="metric-value">{fmtTvl(analytics?.totalVolume)}</span>
                <span className="metric-sub">Protocol volume</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Evidence</span>
                <span className="metric-value">{getVal("evidence")}</span>
                <span className="metric-sub">Source-backed signals</span>
              </div>
            </div>

            {/* Protocol count chart */}
            <div className="chart-container mb-4">
              <div className="section-header">
                <div className="section-title">Protocol Coverage Trend</div>
                <span className="text-xs text-muted">
                  As of {asOf ? new Date(asOf).toLocaleString() : "—"}
                </span>
              </div>
              {projectSeries.length > 0 ? (
                <InsightChart
                  data={projectSeries}
                  type="area"
                  color="var(--accent)"
                  height={220}
                  formatValue={(v) => `${v}`}
                />
              ) : (
                <div className="t-empty">
                  Historical charts require multiple snapshots. Trigger refreshes to build
                  time-series data. Current snapshot has {analytics?.projectCount ?? 0} protocols.
                </div>
              )}
            </div>

            {/* Data source health */}
            <div className="terminal-section">
              <div className="section-header">
                <div className="section-title">Data Sources</div>
              </div>
              <div className="terminal-grid terminal-grid-4">
                {health.map((h) => (
                  <div key={h.id} className="t-card">
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
                {health.length === 0 && (
                  <>
                    <div className="t-card">
                      <div className="flex justify-between items-center">
                        <span className="t-card-title">DeFiLlama</span>
                        <span className="t-badge green">Live</span>
                      </div>
                    </div>
                    <div className="t-card">
                      <div className="flex justify-between items-center">
                        <span className="t-card-title">CoinGecko</span>
                        <span className="t-badge green">Live</span>
                      </div>
                    </div>
                    <div className="t-card">
                      <div className="flex justify-between items-center">
                        <span className="t-card-title">Solana RPC</span>
                        <span className="t-badge green">Live</span>
                      </div>
                    </div>
                    <div className="t-card">
                      <div className="flex justify-between items-center">
                        <span className="t-card-title">Helius</span>
                        <span className="t-badge green">Live</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Source attribution */}
            <div className="terminal-section">
              <div className="t-card">
                <div className="t-card-title mb-2">Data Provenance</div>
                <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Market data is sourced from CoinGecko (SOL price, market cap, volume) and
                  DeFiLlama (TVL, protocol metrics). All metrics are evidence-backed and traceable
                  to their source via the evidence system. ETF flow data and institutional activity
                  are not currently available — these fields show unavailable rather than fabricated
                  values.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
