"use client";

import { useState, useEffect } from "react";
import { useCopilot } from "../../../components/Copilot";
import { InsightChart } from "../../../components/InsightChart";

interface StablecoinData {
  totalSupply: number;
  byToken: Array<{ name: string; symbol: string; supply: number }>;
  history: Array<{ date: number; total: number }>;
}

export default function StablecoinsPage() {
  useCopilot();
  const [data, setData] = useState<StablecoinData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/network-metrics");
        const d = await res.json();
        setData(d.stablecoins ?? null);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmtUsd = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toFixed(0)}`;
  };
  const headerStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-muted)",
    marginBottom: 16,
  };
  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: 11,
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 500,
    borderBottom: "1px solid var(--border)",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    color: "var(--text)",
  };

  // Build stablecoin breakdown from DeFiLlama stablecoin list
  const knownStablecoins = [
    { name: "Tether", symbol: "USDT", issuer: "Tether Limited" },
    { name: "USD Coin", symbol: "USDC", issuer: "Circle" },
    { name: "Sky Dollar", symbol: "USDS", issuer: "Sky" },
    { name: "Ethena USDe", symbol: "USDe", issuer: "Ethena" },
    { name: "Global Dollar", symbol: "USDG", issuer: "Global Dollar" },
    { name: "PayPal USD", symbol: "PYUSD", issuer: "PayPal" },
    { name: "BlackRock USD", symbol: "BUIDL", issuer: "BlackRock" },
    { name: "Ondo US Dollar Yield", symbol: "USDY", issuer: "Ondo Finance" },
    { name: "World Liberty Financial USD", symbol: "USD1", issuer: "WLFI" },
  ];

  return (
    <div className="main-content">
      <div style={{ maxWidth: "none", margin: 0, padding: "32px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          Stablecoins
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32 }}>
          Stablecoin supply, composition, and growth on Solana.
        </p>
        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
        ) : !data ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Stablecoin data unavailable.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 48, marginBottom: 48 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}
                >
                  Total Supply
                </span>
                <span
                  style={{ fontSize: 24, fontFamily: "var(--font-mono)", color: "var(--text)" }}
                >
                  {fmtUsd(data.totalSupply)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}
                >
                  History
                </span>
                <span
                  style={{ fontSize: 24, fontFamily: "var(--font-mono)", color: "var(--text)" }}
                >
                  {data.history?.length ?? 0}d
                </span>
              </div>
            </div>

            {data.history && data.history.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <div style={headerStyle}>Supply History (30D)</div>
                <InsightChart
                  data={data.history.map((h) => ({
                    label: new Date(h.date * 1000).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }),
                    value: h.total,
                  }))}
                  type="area"
                  height={250}
                  color="var(--accent)"
                  formatValue={(v: number) => fmtUsd(v)}
                />
              </div>
            )}

            <div>
              <div style={headerStyle}>Stablecoin Breakdown</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Token</th>
                    <th style={thStyle}>Symbol</th>
                    <th style={thStyle}>Issuer</th>
                    <th style={thStyle}>Supply</th>
                    <th style={thStyle}>% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {knownStablecoins.map((s, i) => {
                    const share = data.totalSupply > 0 ? 0 : 0;
                    return (
                      <tr
                        key={s.symbol}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{i + 1}</td>
                        <td style={tdStyle}>{s.name}</td>
                        <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{s.symbol}</td>
                        <td style={{ ...tdStyle, color: "var(--text-muted)" }}>{s.issuer}</td>
                        <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>—</td>
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          —
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                Per-token supply breakdown requires DeFiLlama stablecoin API. Total supply is
                accurate.
              </p>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                marginTop: 32,
              }}
            >
              Source: DeFiLlama
            </div>
          </>
        )}
      </div>
    </div>
  );
}
