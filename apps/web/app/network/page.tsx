"use client";

import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";
import { InsightChart } from "../../components/InsightChart";

interface HealthProvider {
  id: string;
  status: string;
}

interface NetworkData {
  status: string;
  providers: HealthProvider[];
}

function fmtNum(v: number | undefined): string {
  if (v === undefined || v === null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

export default function NetworkPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Network] User is viewing Solana network analytics including TPS, slot time, epoch progress, validators, delinquency, stake distribution, inflation, and RPC health.",
    );
  }, [setPageContext]);

  const [health, setHealth] = useState<HealthProvider[]>([]);
  const [status, setStatus] = useState("unknown");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data = (await res.json()) as NetworkData;
      setHealth(data.providers ?? []);
      setStatus(data.status ?? "unknown");
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rpcHealth = health.find((h) => h.id === "solana-rpc");
  const heliusHealth = health.find((h) => h.id === "helius");

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">NETWORK</p>
        <h1 style={{ fontSize: 32 }}>Solana network intelligence</h1>
        <p className="subtitle">Validator health, network performance, and RPC status</p>
      </div>

      <div className="terminal-main">
        {loading && <div className="t-loading">Loading network data...</div>}

        {!loading && (
          <>
            {/* Source health */}
            <div className="terminal-section">
              <div className="section-header">
                <div>
                  <div className="section-title">Source Health</div>
                  <div className="section-subtitle">Overall status: {status}</div>
                </div>
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

            {/* Network metrics placeholder — honest about availability */}
            <div className="terminal-section">
              <div className="section-header">
                <div>
                  <div className="section-title">Network Metrics</div>
                  <div className="section-subtitle">From Solana RPC</div>
                </div>
              </div>
              <div className="terminal-grid terminal-grid-4">
                <div className="metric-card">
                  <span className="metric-label">TPS</span>
                  <span className="metric-value">—</span>
                  <span className="metric-sub">
                    <span
                      className={`t-badge ${rpcHealth?.status === "healthy" ? "green" : "red"}`}
                    >
                      {rpcHealth?.status === "healthy" ? "LIVE" : "UNAVAILABLE"}
                    </span>
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Slot Time</span>
                  <span className="metric-value">—</span>
                  <span className="metric-sub">RPC required</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Epoch</span>
                  <span className="metric-value">—</span>
                  <span className="metric-sub">RPC required</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Validators</span>
                  <span className="metric-value">—</span>
                  <span className="metric-sub">RPC required</span>
                </div>
              </div>
              <div className="t-card mt-4">
                <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Network metrics (TPS, slot time, epoch, validators, stake distribution) require
                  Solana RPC access. The public RPC endpoint may be rate-limited from Vercel&apos;s
                  serverless infrastructure.
                  {heliusHealth?.status === "healthy" &&
                    " Helius API is available and can be used as fallback for enhanced on-chain data."}
                  {rpcHealth?.status !== "healthy" &&
                    " RPC is currently unavailable — metrics show — rather than fake values."}
                </p>
              </div>
            </div>

            {/* What we track */}
            <div className="terminal-section">
              <div className="section-header">
                <div className="section-title">Tracked Metrics</div>
              </div>
              <div className="t-card">
                <table className="t-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>TPS</td>
                      <td>Solana RPC</td>
                      <td>
                        <span
                          className={`t-badge ${rpcHealth?.status === "healthy" ? "green" : "red"}`}
                        >
                          {rpcHealth?.status === "healthy" ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="text-xs text-muted">
                        Transactions per second from performance samples
                      </td>
                    </tr>
                    <tr>
                      <td>Epoch</td>
                      <td>Solana RPC</td>
                      <td>
                        <span
                          className={`t-badge ${rpcHealth?.status === "healthy" ? "green" : "red"}`}
                        >
                          {rpcHealth?.status === "healthy" ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="text-xs text-muted">
                        Epoch number, slot index, slots in epoch, progress
                      </td>
                    </tr>
                    <tr>
                      <td>Validators</td>
                      <td>Solana RPC</td>
                      <td>
                        <span
                          className={`t-badge ${rpcHealth?.status === "healthy" ? "green" : "red"}`}
                        >
                          {rpcHealth?.status === "healthy" ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="text-xs text-muted">
                        Active/delinquent validators, stake, commission
                      </td>
                    </tr>
                    <tr>
                      <td>Inflation</td>
                      <td>Solana RPC</td>
                      <td>
                        <span
                          className={`t-badge ${rpcHealth?.status === "healthy" ? "green" : "red"}`}
                        >
                          {rpcHealth?.status === "healthy" ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="text-xs text-muted">
                        Total, validator, and foundation inflation rates
                      </td>
                    </tr>
                    <tr>
                      <td>Cluster Nodes</td>
                      <td>Solana RPC</td>
                      <td>
                        <span
                          className={`t-badge ${rpcHealth?.status === "healthy" ? "green" : "red"}`}
                        >
                          {rpcHealth?.status === "healthy" ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="text-xs text-muted">Total cluster node count and versions</td>
                    </tr>
                    <tr>
                      <td>Block Height</td>
                      <td>Solana RPC</td>
                      <td>
                        <span
                          className={`t-badge ${rpcHealth?.status === "healthy" ? "green" : "red"}`}
                        >
                          {rpcHealth?.status === "healthy" ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="text-xs text-muted">
                        Current block height and transaction count
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
