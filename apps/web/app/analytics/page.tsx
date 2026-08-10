"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InsightChart } from "../../components/InsightChart";
import { ProjectLogo } from "../../components/ProjectLogo";
import { useCopilot } from "../../components/Copilot";

interface Project {
  id: string;
  name: string;
  category: string;
  metrics: { tvl?: number; volume24h?: number };
  logoUrl?: string;
  change24h?: number;
  classification?: string;
}
interface AnalyticsData {
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
  categoryCount: number;
  categoryDistribution: { category: string; count: number }[];
}

function fmtUsd(v: number | undefined): string {
  if (!v) return "\u2014";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

const rule = { borderTop: "2px solid #3d2e1e", margin: "24px 0" };
const sectionHeader = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text)",
};
const label = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

export default function AnalyticsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Analytics] Solana DeFi analytics with TVL charts, category breakdown, protocol rankings.",
    );
  }, [setPageContext]);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"tvl" | "volume24h" | "name">("tvl");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [aRes, pRes] = await Promise.all([
        fetch("/api/analytics")
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/projects?classification=solana_ecosystem")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
      ]);
      if (aRes) setAnalytics(aRes);
      setProjects(pRes.projects ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const eco = projects.filter((p) => !p.classification || p.classification === "solana_ecosystem");
  const categories = ["all", ...new Set(eco.map((p) => p.category))];
  const filtered = eco
    .filter((p) => category === "all" || p.category === category)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b.metrics[sort] ?? 0) - (a.metrics[sort] ?? 0);
    });

  const catChart =
    analytics?.categoryDistribution
      ?.slice(0, 12)
      .map((c) => ({ label: c.category, value: c.count })) ?? [];
  const tvlChart =
    [...eco]
      .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
      .slice(0, 10)
      .map((p) => ({ label: p.name.slice(0, 10), value: p.metrics?.tvl ?? 0 })) ?? [];

  return (
    <div style={{ background: "var(--linen)", minHeight: "100vh" }}>
      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "32px 24px 0" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            fontWeight: 700,
            margin: 0,
            color: "var(--text)",
          }}
        >
          Analytics
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
          DeFi TVL, DEX volume, category breakdown, protocol rankings
        </p>
      </div>

      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 24px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            Loading analytics...
          </div>
        )}

        {!loading && analytics && (
          <>
            {/* Stats strip */}
            <div
              style={{
                display: "flex",
                gap: 0,
                marginTop: 24,
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {[
                { l: "Total TVL", v: fmtUsd(analytics.totalTvl) },
                { l: "DEX Volume", v: fmtUsd(analytics.totalVolume) },
                { l: "Protocols", v: `${analytics.projectCount}` },
                { l: "Categories", v: `${analytics.categoryCount}` },
              ].map((s, i) => (
                <div
                  key={s.l}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRight: i < 3 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={label}>{s.l}</div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text)",
                      marginTop: 2,
                    }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>

            <div style={rule} />

            {/* TVL chart */}
            <div style={sectionHeader}>Top 10 Protocols by TVL</div>
            {tvlChart.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <InsightChart
                  data={tvlChart}
                  type="bar"
                  color="var(--brown)"
                  height={220}
                  formatValue={(v) => fmtUsd(v)}
                />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                TVL data unavailable.
              </div>
            )}
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                marginTop: 4,
              }}
            >
              Source: DeFiLlama
            </div>

            <div style={rule} />

            {/* Category chart */}
            <div style={sectionHeader}>Category Distribution</div>
            {catChart.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <InsightChart
                  data={catChart}
                  type="bar"
                  color="var(--brown)"
                  height={200}
                  formatValue={(v) => `${v}`}
                />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                No category data.
              </div>
            )}

            <div style={rule} />

            {/* Rankings table */}
            <div style={sectionHeader}>Protocol Rankings</div>

            {/* Controls */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                placeholder="Search protocols..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: "6px 10px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: 13,
                  color: "var(--text)",
                }}
              />
              <div style={{ display: "flex", gap: 0 }}>
                {(["tvl", "volume24h", "name"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      background: sort === k ? "var(--text)" : "transparent",
                      color: sort === k ? "var(--linen)" : "var(--text-muted)",
                      border: "1px solid var(--border)",
                      borderRight: k !== "name" ? "none" : "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    {k === "tvl" ? "TVL" : k === "volume24h" ? "VOL" : "NAME"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {categories.slice(0, 15).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    padding: "3px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    background: category === c ? "var(--brown)" : "transparent",
                    color: category === c ? "#fff" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  {c === "all" ? "ALL" : c}
                </button>
              ))}
            </div>

            {/* Table */}
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border)" }}>
              <table className="t-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>Protocol</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>TVL</th>
                    <th style={{ textAlign: "right" }}>24h</th>
                    <th style={{ textAlign: "right" }}>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 50).map((p, i) => (
                    <tr key={p.id}>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                      >
                        {i + 1}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <ProjectLogo src={p.logoUrl} name={p.name} size={18} />
                          <Link
                            href={`/projects/${p.id}`}
                            style={{ fontSize: 13, color: "var(--text)" }}
                          >
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.category}</td>
                      <td
                        style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12 }}
                      >
                        {fmtUsd(p.metrics?.tvl)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: (p.change24h ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                        }}
                      >
                        {p.change24h !== undefined
                          ? `${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(1)}%`
                          : "\u2014"}
                      </td>
                      <td
                        style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12 }}
                      >
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
                marginTop: 8,
              }}
            >
              Source: DeFiLlama \u00b7 Showing {Math.min(50, filtered.length)} of {filtered.length}{" "}
              protocols
            </div>
          </>
        )}
      </div>
    </div>
  );
}
