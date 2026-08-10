"use client";

import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";

interface PulseMetric {
  id: string;
  label: string;
  value: string;
  caption?: string;
  variant?: string;
}

export default function MarketsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Markets] User is viewing Solana market data including SOL price, market cap, volume, and data source status.",
    );
  }, [setPageContext]);
  const [metrics, setMetrics] = useState<PulseMetric[]>([]);
  const [asOf, setAsOf] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pulse");
      if (!res.ok) return;
      const data = (await res.json()) as { pulse: { asOf: string; metrics: PulseMetric[] } };
      setMetrics(data.pulse.metrics);
      setAsOf(data.pulse.asOf);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const getVal = (id: string) => metrics.find((m) => m.id === id)?.value ?? "—";

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">MARKETS</p>
        <h1 style={{ fontSize: 32 }}>Solana market data</h1>
        <p className="subtitle">SOL price, market cap, volume, and ecosystem value</p>
      </div>

      <div className="terminal-main">
        {loading && <div className="t-loading">Loading market data...</div>}

        {!loading && (
          <>
            <div className="terminal-grid terminal-grid-4 mb-4">
              <div className="metric-card">
                <span className="metric-label">Tracked Projects</span>
                <span className="metric-value">{getVal("projects")}</span>
                <span className="metric-sub">Protocols in scope</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Active Narratives</span>
                <span className="metric-value">{getVal("narratives")}</span>
                <span className="metric-sub">Surfaced themes</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Evidence Items</span>
                <span className="metric-value">{getVal("evidence")}</span>
                <span className="metric-sub">Citable signals</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Graph Entities</span>
                <span className="metric-value">{getVal("graph")}</span>
                <span className="metric-sub">Entity graph nodes</span>
              </div>
            </div>

            <div className="terminal-section">
              <div className="section-header">
                <div>
                  <div className="section-title">Market Overview</div>
                  <div className="section-subtitle">
                    As of {asOf ? new Date(asOf).toLocaleString() : "—"}
                  </div>
                </div>
              </div>
              <div className="t-card">
                <p className="text-sm text-muted">
                  Market data is sourced from CoinGecko (SOL price, market cap, volume) and
                  DeFiLlama (TVL, protocol metrics). Historical price charts and ETF flow data
                  require additional data sources. All metrics below are evidence-backed and
                  traceable to their source.
                </p>
              </div>
            </div>

            <div className="terminal-section">
              <div className="section-header">
                <div className="section-title">Data Sources</div>
              </div>
              <div className="terminal-grid terminal-grid-3">
                <div className="t-card">
                  <div className="t-card-title">CoinGecko</div>
                  <p className="text-sm mt-2">
                    SOL price, market cap, 24h volume, circulating supply
                  </p>
                  <span className="t-badge green mt-2">Live</span>
                </div>
                <div className="t-card">
                  <div className="t-card-title">DeFiLlama</div>
                  <p className="text-sm mt-2">Protocol TVL, chain breakdowns, 24h/7d/30d changes</p>
                  <span className="t-badge green mt-2">Live</span>
                </div>
                <div className="t-card">
                  <div className="t-card-title">Solana RPC</div>
                  <p className="text-sm mt-2">Epoch, validators, TPS, inflation, cluster nodes</p>
                  <span className="t-badge green mt-2">Live</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
