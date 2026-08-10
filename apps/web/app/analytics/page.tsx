"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";
import { InsightChart } from "../../components/InsightChart";
import { ProjectLogo } from "../../components/ProjectLogo";

// ── Types ─────────────────────────────────────────────────────

interface CategoryDist {
  category: string;
  count: number;
}

interface TopProject {
  id: string;
  name: string;
  tvl: number;
  category: string;
}

interface ProjectMetrics {
  tvl?: number;
  volume24h?: number;
  activeUsers24h?: number;
  developerActivity?: number;
}

interface Project {
  id: string;
  name: string;
  category: string;
  description?: string;
  metrics: ProjectMetrics;
  chain?: string;
  classification?: string;
  logoUrl?: string;
  change24h?: number;
  change7d?: number;
  change30d?: number;
}

interface AnalyticsData {
  totalTvl: number;
  totalVolume: number;
  projectCount: number;
  categoryCount: number;
  categoryDistribution: CategoryDist[];
  topByTvl: TopProject[];
}

// ── Helpers ───────────────────────────────────────────────────

function fmtTvl(v: number | undefined): string {
  if (v === undefined || v === null || isNaN(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function fmtVolume(v: number | undefined): string {
  return fmtTvl(v);
}

function fmtChange(v: number | undefined): string {
  if (v === undefined || v === null || isNaN(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

type SortKey = "tvl" | "volume24h" | "name";
type CategoryFilter = string | "all";

// ── Theme helpers for inline styles ────────────────────────────

const th = {
  linen: "var(--linen)",
  bgCard: "var(--bg-card)",
  border: "var(--border)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  brown: "var(--brown)",
  green: "var(--green)",
  red: "var(--red)",
  fontMono: "var(--font-mono)",
  radius: "var(--radius)",
};

// ── Component ──────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Analytics] User is viewing the DeFi analytics terminal — TVL charts, category distribution, and protocol rankings for the Solana ecosystem.",
    );
  }, [setPageContext]);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("tvl");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [timestamp, setTimestamp] = useState<string>("");

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
      setProjects(
        (pRes.projects ?? []).filter(
          (p: Project) => p.classification === undefined || p.classification === "solana_ecosystem",
        ),
      );
    } catch {
      /* ignore */
    }
    setLoading(false);
    setTimestamp(new Date().toISOString());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Derived category list
  const categories = ["all", ...new Set(projects.map((p) => p.category))];

  // Filtered + sorted projects for the rankings table
  const filtered = projects
    .filter((p) => category === "all" || p.category === category)
    .filter(
      (p) =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b.metrics[sort] ?? 0) - (a.metrics[sort] ?? 0);
    });

  // Aggregate totals from filtered set (for dynamic header)
  const aggTvl = filtered.reduce((s, p) => s + (p.metrics.tvl ?? 0), 0);
  const aggVol = filtered.reduce((s, p) => s + (p.metrics.volume24h ?? 0), 0);

  // Compute 24h change weighted by TVL for header display
  const projectsWithChange = filtered.filter((p) => p.change24h !== undefined && p.metrics.tvl);
  const totalTvlWithChange = projectsWithChange.reduce((s, p) => s + (p.metrics.tvl ?? 0), 0);
  const weightedChange =
    totalTvlWithChange > 0
      ? projectsWithChange.reduce((s, p) => s + (p.change24h ?? 0) * (p.metrics.tvl ?? 0), 0) /
        totalTvlWithChange
      : undefined;

  // ── Chart data ───────────────────────────────────────────────

  const tvlChartData: { label: string; value: number }[] =
    analytics?.topByTvl.slice(0, 10).map((p) => ({ label: p.name, value: p.tvl })) ?? [];

  const categoryChartData: { label: string; value: number }[] =
    analytics?.categoryDistribution.map((c) => ({
      label: c.category,
      value: c.count,
    })) ?? [];

  // Map topByTvl ids to project info for logo lookup
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: th.linen }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
        {/* ── Page Header ─────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: th.brown,
              fontWeight: 600,
              margin: 0,
              marginBottom: 4,
            }}
          >
            ANALYTICS TERMINAL
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: th.text,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Solana Ecosystem Analytics
          </h1>
          <p style={{ fontSize: 14, color: th.textMuted, margin: 0 }}>
            TVL distribution, category breakdowns, and protocol rankings
          </p>
        </div>

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              color: th.textMuted,
              fontFamily: th.fontMono,
              fontSize: 13,
            }}
          >
            Loading analytics...
          </div>
        )}

        {!loading && (
          <>
            {/* ── Metric Header ────────────────────────────────── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              {/* Total TVL */}
              <MetricCard
                label="Total TVL"
                value={fmtTvl(analytics?.totalTvl ?? aggTvl)}
                change={weightedChange}
              />
              {/* DEX Volume */}
              <MetricCard
                label="DEX Volume"
                value={fmtVolume(analytics?.totalVolume ?? aggVol)}
                change={undefined}
                subLabel="24h"
              />
              {/* Protocol Count */}
              <MetricCard
                label="Protocols"
                value={String(analytics?.projectCount ?? projects.length)}
                subLabel="tracked"
              />
              {/* Category Count */}
              <MetricCard
                label="Categories"
                value={String(analytics?.categoryCount ?? categories.length - 1)}
                subLabel="sectors"
              />
            </div>

            {/* ── TVL Chart + Category Distribution ─────────────── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {/* TVL Bar Chart */}
              <div
                style={{
                  background: th.bgCard,
                  border: `1px solid ${th.border}`,
                  borderRadius: th.radius,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: th.text,
                    }}
                  >
                    Top 10 Protocols by TVL
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: th.textMuted,
                      fontFamily: th.fontMono,
                    }}
                  >
                    {tvlChartData.length} protocols
                  </span>
                </div>
                {tvlChartData.length > 0 ? (
                  <InsightChart
                    data={tvlChartData}
                    type="bar"
                    color={th.brown}
                    height={220}
                    formatValue={(v) => fmtTvl(v)}
                  />
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: th.textMuted,
                      fontSize: 13,
                    }}
                  >
                    No TVL data available.
                  </div>
                )}
              </div>

              {/* Category Distribution */}
              <div
                style={{
                  background: th.bgCard,
                  border: `1px solid ${th.border}`,
                  borderRadius: th.radius,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: th.text,
                    }}
                  >
                    Category Distribution
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: th.textMuted,
                      fontFamily: th.fontMono,
                    }}
                  >
                    {categoryChartData.length} categories
                  </span>
                </div>
                {categoryChartData.length > 0 ? (
                  <InsightChart
                    data={categoryChartData}
                    type="bar"
                    color="#8b6f47"
                    height={220}
                    formatValue={(v) => `${v}`}
                  />
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: th.textMuted,
                      fontSize: 13,
                    }}
                  >
                    No category data available.
                  </div>
                )}
              </div>
            </div>

            {/* ── Controls Bar ──────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap" as const,
              }}
            >
              <input
                placeholder="Search protocols..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  maxWidth: 280,
                  flex: "1 1 auto",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontFamily: th.fontMono,
                  background: th.bgCard,
                  border: `1px solid ${th.border}`,
                  borderRadius: th.radius,
                  color: th.text,
                  outline: "none",
                }}
              />
              {/* Sort buttons */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  background: th.bgCard,
                  border: `1px solid ${th.border}`,
                  borderRadius: th.radius,
                  padding: 2,
                }}
              >
                {(["tvl", "volume24h", "name"] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      background: sort === k ? th.brown : "transparent",
                      color: sort === k ? th.linen : th.textMuted,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {k === "tvl" ? "TVL" : k === "volume24h" ? "Volume" : "Name"}
                  </button>
                ))}
              </div>
              {/* Category filter buttons */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap" as const,
                  maxWidth: 600,
                }}
              >
                {categories.slice(0, 10).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    style={{
                      padding: "6px 10px",
                      fontSize: 11,
                      fontWeight: 500,
                      border: `1px solid ${th.border}`,
                      borderRadius: th.radius,
                      cursor: "pointer",
                      background: category === c ? th.brown : th.bgCard,
                      color: category === c ? th.linen : th.textMuted,
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {c === "all" ? "All" : c}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Protocol Rankings Table ──────────────────────── */}
            <div
              style={{
                background: th.bgCard,
                border: `1px solid ${th.border}`,
                borderRadius: th.radius,
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${th.border}`,
                      background: th.linen,
                    }}
                  >
                    <th style={thHeaderLeft}>#</th>
                    <th style={thHeaderLeft}>Protocol</th>
                    <th style={thHeaderLeft}>Category</th>
                    <th
                      style={{
                        ...thHeaderRight,
                        cursor: "pointer",
                      }}
                      onClick={() => setSort("tvl")}
                    >
                      TVL {sort === "tvl" ? "↓" : ""}
                    </th>
                    <th style={thHeaderLeft}>24h Change</th>
                    <th
                      style={{
                        ...thHeaderRight,
                        cursor: "pointer",
                      }}
                      onClick={() => setSort("volume24h")}
                    >
                      Volume {sort === "volume24h" ? "↓" : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: "center",
                          padding: 40,
                          color: th.textMuted,
                          fontSize: 13,
                        }}
                      >
                        No protocols match the current filters.
                      </td>
                    </tr>
                  )}
                  {filtered.slice(0, 100).map((p, i) => {
                    const isUp = (p.change24h ?? 0) >= 0;
                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: `1px solid ${th.border}`,
                          transition: "background 0.1s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = th.linen;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td
                          style={{
                            ...tdCell,
                            color: th.textMuted,
                            fontFamily: th.fontMono,
                            fontSize: 12,
                            width: 40,
                          }}
                        >
                          {i + 1}
                        </td>
                        <td style={tdCell}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <ProjectLogo src={p.logoUrl} name={p.name} size={20} />
                            <Link
                              href={`/projects/${p.id}`}
                              style={{
                                color: th.text,
                                textDecoration: "none",
                                fontWeight: 500,
                                fontSize: 13,
                              }}
                            >
                              {p.name}
                            </Link>
                          </div>
                        </td>
                        <td style={tdCell}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 500,
                              color: th.brown,
                              background: "rgba(139, 111, 71, 0.08)",
                              borderRadius: "4px",
                            }}
                          >
                            {p.category}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdCellRight,
                            fontFamily: th.fontMono,
                            fontWeight: 600,
                          }}
                        >
                          {fmtTvl(p.metrics.tvl)}
                        </td>
                        <td style={tdCell}>
                          <span
                            style={{
                              fontFamily: th.fontMono,
                              fontSize: 12,
                              fontWeight: 600,
                              color: isUp ? th.green : th.red,
                            }}
                          >
                            {fmtChange(p.change24h)}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdCellRight,
                            fontFamily: th.fontMono,
                            color: th.textMuted,
                          }}
                        >
                          {fmtVolume(p.metrics.volume24h)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > 100 && (
              <p
                style={{
                  fontSize: 12,
                  color: th.textMuted,
                  marginTop: 8,
                  fontFamily: th.fontMono,
                }}
              >
                Showing 100 of {filtered.length} protocols.
              </p>
            )}

            {/* ── Source Attribution ────────────────────────────── */}
            <div
              style={{
                marginTop: 20,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: th.textMuted,
                  fontFamily: th.fontMono,
                }}
              >
                Source: DeFiLlama
                {timestamp && ` · Updated ${new Date(timestamp).toLocaleString()}`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  change,
  subLabel,
}: {
  label: string;
  value: string;
  change?: number;
  subLabel?: string;
}) {
  const isUp = (change ?? 0) >= 0;
  return (
    <div
      style={{
        background: th.bgCard,
        border: `1px solid ${th.border}`,
        borderRadius: th.radius,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: th.textMuted,
          fontWeight: 500,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: th.text,
          fontFamily: th.fontMono,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: th.textMuted,
        }}
      >
        {change !== undefined && (
          <span
            style={{
              fontFamily: th.fontMono,
              fontWeight: 600,
              color: isUp ? th.green : th.red,
            }}
          >
            {fmtChange(change)}
          </span>
        )}
        {subLabel && <span>{subLabel}</span>}
      </div>
    </div>
  );
}

// ── Shared table cell styles ───────────────────────────────────

const thHeaderLeft: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: th.textMuted,
};

const thHeaderRight: React.CSSProperties = {
  ...thHeaderLeft,
  textAlign: "right",
};

const tdCell: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: th.text,
  verticalAlign: "middle",
};

const tdCellRight: React.CSSProperties = {
  ...tdCell,
  textAlign: "right",
};
