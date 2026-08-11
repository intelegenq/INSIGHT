"use client";

import { useState, useEffect } from "react";
import { useCopilot } from "../../../components/Copilot";
import { InsightChart } from "../../../components/InsightChart";
import { ProjectLogo } from "../../../components/ProjectLogo";

interface RwaProtocol {
  name: string;
  tvl: number;
  category: string;
}

export default function RWAPage() {
  useCopilot();
  const [protocols, setProtocols] = useState<RwaProtocol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/network-metrics");
        const data = await res.json();
        setProtocols(data.rwaProtocols ?? []);
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
  const totalTvl = protocols.reduce((s, p) => s + p.tvl, 0);
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

  return (
    <div className="main-content">
      <div style={{ maxWidth: "none", margin: 0, padding: "32px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          RWA
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32 }}>
          Real World Assets — tokenized equities, commodities, and funds on Solana.
        </p>
        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
        ) : protocols.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No RWA protocols found.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 48, marginBottom: 48 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}
                >
                  Total RWA Value
                </span>
                <span
                  style={{ fontSize: 24, fontFamily: "var(--font-mono)", color: "var(--text)" }}
                >
                  {fmtUsd(totalTvl)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}
                >
                  Protocols
                </span>
                <span
                  style={{ fontSize: 24, fontFamily: "var(--font-mono)", color: "var(--text)" }}
                >
                  {protocols.length}
                </span>
              </div>
            </div>
            <div style={{ marginBottom: 48 }}>
              <div style={headerStyle}>TVL Distribution</div>
              <InsightChart
                data={protocols.map((p) => ({ label: p.name, value: p.tvl }))}
                type="bar"
                height={250}
                color="var(--accent)"
                formatValue={(v: number) => fmtUsd(v)}
              />
            </div>
            <div>
              <div style={headerStyle}>Protocol Details</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Protocol</th>
                    <th style={thStyle}>TVL</th>
                  </tr>
                </thead>
                <tbody>
                  {protocols.map((p, i) => (
                    <tr
                      key={p.name}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{i + 1}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ProjectLogo src={undefined} name={p.name} size={20} />
                          {p.name}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>
                        {fmtUsd(p.tvl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
