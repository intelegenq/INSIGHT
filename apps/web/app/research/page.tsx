"use client";

import { useState, useEffect } from "react";
import { useCopilot } from "../../components/Copilot";
import Link from "next/link";

interface Evidence {
  id: string;
  source: string;
  metric: string;
  value: string;
  timestamp: string;
  url?: string;
}

interface Snapshot {
  id: string;
  referenceDate: string;
  projects: number;
  narratives: number;
  evidence: number;
}

interface Upgrade {
  name: string;
  description: string;
  status: string;
  simd: string;
}

export default function ResearchPage() {
  useCopilot();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [evRes, snapRes, nmRes] = await Promise.all([
          fetch("/api/evidence")
            .then((r) => r.json())
            .catch(() => ({ evidence: [] })),
          fetch("/api/snapshots")
            .then((r) => r.json())
            .catch(() => ({ snapshots: [] })),
          fetch("/api/network-metrics")
            .then((r) => r.json())
            .catch(() => ({})),
        ]);
        setEvidence(evRes.evidence ?? []);
        setSnapshots(snapRes.snapshots ?? []);
        setUpgrades(nmRes.upcomingUpgrades ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sectionStyle: React.CSSProperties = {
    marginBottom: 48,
  };
  const headerStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-muted)",
    marginBottom: 16,
  };
  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
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
  const monoStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--text-secondary)",
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: "none", margin: 0, padding: "32px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          Research
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32 }}>
          Evidence-backed reports, snapshots, and upcoming upgrades.
        </p>

        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
        ) : (
          <>
            {/* Reports */}
            <div style={sectionStyle}>
              <div style={headerStyle}>Reports</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                Export the full Solana ecosystem report in multiple formats.
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <Link
                  href="/api/reports/export?format=markdown"
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    borderRadius: "var(--radius)",
                    textDecoration: "none",
                    border: "1px solid var(--border)",
                  }}
                >
                  ↓ Markdown
                </Link>
                <Link
                  href="/api/reports/export?format=json"
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    borderRadius: "var(--radius)",
                    textDecoration: "none",
                    border: "1px solid var(--border)",
                  }}
                >
                  ↓ JSON
                </Link>
              </div>
            </div>

            {/* Upcoming Upgrades */}
            <div style={sectionStyle}>
              <div style={headerStyle}>Upcoming Upgrades</div>
              {upgrades.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {upgrades.map((u) => (
                    <div
                      key={u.simd}
                      style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)" }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                          {u.name}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            background: "var(--bg-elevated)",
                            color: "var(--text-secondary)",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          {u.simd}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: u.status === "Active" ? "var(--green)" : "var(--text-muted)",
                          }}
                        >
                          {u.status}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {u.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  No upgrade data available.
                </div>
              )}
            </div>

            {/* Evidence */}
            <div style={sectionStyle}>
              <div style={headerStyle}>Evidence ({evidence.length})</div>
              {evidence.length > 0 ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Source</th>
                      <th style={thStyle}>Metric</th>
                      <th style={thStyle}>Value</th>
                      <th style={thStyle}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.slice(0, 50).map((e) => (
                      <tr key={e.id}>
                        <td style={tdStyle}>{e.source}</td>
                        <td style={tdStyle}>{e.metric}</td>
                        <td style={{ ...tdStyle, ...monoStyle }}>{e.value}</td>
                        <td style={{ ...tdStyle, ...monoStyle }}>
                          {e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  No evidence data available.
                </div>
              )}
            </div>

            {/* Snapshot History */}
            <div style={sectionStyle}>
              <div style={headerStyle}>Snapshot History</div>
              {snapshots.length > 0 ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Projects</th>
                      <th style={thStyle}>Narratives</th>
                      <th style={thStyle}>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots
                      .slice(-20)
                      .reverse()
                      .map((s) => (
                        <tr key={s.id}>
                          <td style={{ ...tdStyle, ...monoStyle }}>
                            {new Date(s.referenceDate).toLocaleDateString()}
                          </td>
                          <td style={{ ...tdStyle, ...monoStyle }}>{s.projects}</td>
                          <td style={{ ...tdStyle, ...monoStyle }}>{s.narratives}</td>
                          <td style={{ ...tdStyle, ...monoStyle }}>{s.evidence}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  No snapshots available.
                </div>
              )}
            </div>

            {/* Source attribution */}
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Source: All providers aggregated · Evidence traceable per item
            </div>
          </>
        )}
      </div>
    </div>
  );
}
