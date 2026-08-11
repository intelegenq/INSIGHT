"use client";

import { useState, useEffect } from "react";
import { useCopilot } from "../../../components/Copilot";
import { InsightChart } from "../../../components/InsightChart";
import { ProjectLogo } from "../../../components/ProjectLogo";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  category: string;
  metrics: { tvl?: number; volume24h?: number };
  logoUrl?: string;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  classification?: string;
}

export default function DeFiPage() {
  useCopilot();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects?classification=solana_ecosystem");
        const data = await res.json();
        const defi = (data.projects || []).filter(
          (p: Project) =>
            p.category === "defi" || p.category === "yield" || p.category === "derivatives",
        );
        setProjects(
          defi.sort((a: Project, b: Project) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0)),
        );
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmtUsd = (v?: number) => {
    if (!v || v === 0) return "—";
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toFixed(0)}`;
  };

  const totalTvl = projects.reduce((s, p) => s + (p.metrics?.tvl ?? 0), 0);
  const totalVol = projects.reduce((s, p) => s + (p.metrics?.volume24h ?? 0), 0);

  const headerStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-muted)",
    marginBottom: 16,
  };
  const metricStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    color: "var(--text-muted)",
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 24,
    fontFamily: "var(--font-mono)",
    color: "var(--text)",
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
          DeFi
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32 }}>
          Solana DeFi protocols — TVL, volume, and performance.
        </p>

        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
        ) : projects.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No DeFi protocols found.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 48, marginBottom: 48 }}>
              <div style={metricStyle}>
                <span style={labelStyle}>Total TVL</span>
                <span style={valueStyle}>{fmtUsd(totalTvl)}</span>
              </div>
              <div style={metricStyle}>
                <span style={labelStyle}>Total Volume 24h</span>
                <span style={valueStyle}>{fmtUsd(totalVol)}</span>
              </div>
              <div style={metricStyle}>
                <span style={labelStyle}>Protocols</span>
                <span style={valueStyle}>{projects.length}</span>
              </div>
            </div>

            <div style={{ marginBottom: 48 }}>
              <div style={headerStyle}>TVL Distribution</div>
              <InsightChart
                data={projects
                  .slice(0, 15)
                  .map((p) => ({ label: p.name, value: p.metrics?.tvl ?? 0 }))}
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
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>TVL</th>
                    <th style={thStyle}>24h</th>
                    <th style={thStyle}>7d</th>
                    <th style={thStyle}>30d</th>
                    <th style={thStyle}>Volume 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => (
                    <tr
                      key={p.id}
                      style={{ transition: "background 0.1s" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{i + 1}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ProjectLogo src={p.logoUrl} name={p.name} size={20} />
                          <Link
                            href={`/analytics/${p.id}`}
                            style={{ color: "var(--accent)", textDecoration: "none" }}
                          >
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-muted)" }}>{p.category}</td>
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>
                        {fmtUsd(p.metrics?.tvl)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "var(--font-mono)",
                          color: (p.change24h ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                        }}
                      >
                        {p.change24h != null
                          ? `${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "var(--font-mono)",
                          color: (p.change7d ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                        }}
                      >
                        {p.change7d != null
                          ? `${p.change7d >= 0 ? "+" : ""}${p.change7d.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "var(--font-mono)",
                          color: (p.change30d ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                        }}
                      >
                        {p.change30d != null
                          ? `${p.change30d >= 0 ? "+" : ""}${p.change30d.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>
                        {fmtUsd(p.metrics?.volume24h)}
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
