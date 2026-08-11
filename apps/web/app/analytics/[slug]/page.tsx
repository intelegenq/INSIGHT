"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { InsightChart, StackedBar } from "../../../components/InsightChart";
import { ProjectLogo } from "../../../components/ProjectLogo";
import { useCopilot } from "../../../components/Copilot";

interface Project {
  id: string;
  name: string;
  category: string;
  description?: string;
  metrics: { tvl?: number; volume24h?: number };
  logoUrl?: string;
  slug?: string;
  symbol?: string;
  website?: string;
  change24h?: number;
  change7d?: number;
  change30d?: number;
}

interface HistoryPoint {
  timestamp: string;
  tvl: number;
}

interface HistoryResp {
  history: HistoryPoint[];
  currentTvl: number | null;
  chainTvls: Record<string, number> | null;
}

function fmtUsd(v: number | undefined | null): string {
  if (v === undefined || v === null || v === 0) return "\u2014";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function fmtPct(v: number | undefined): string {
  if (v === undefined) return "\u2014";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function changeColor(v: number | undefined): string {
  if (v === undefined) return "var(--text-muted)";
  return v >= 0 ? "var(--green)" : "var(--red)";
}

function projectSlug(p: Project): string {
  if (p.slug) return p.slug.split("/")[0];
  return p.name.toLowerCase().replace(/\s+/g, "-");
}

export default function AnalyticsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { setPageContext } = useCopilot();

  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<HistoryResp | null>(null);
  const [range, setRange] = useState<30 | 90 | 365>(90);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects?classification=all");
        const data = await res.json();
        setProjects(data.projects ?? []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const project = useMemo(
    () => projects.find((p) => projectSlug(p) === decodeURIComponent(slug)),
    [projects, slug],
  );

  useEffect(() => {
    if (!project) return;
    setPageContext(
      `[Analytics Detail] ${project.name} (${project.category}) — TVL ${fmtUsd(project.metrics?.tvl)}, 24h volume ${fmtUsd(project.metrics?.volume24h)}.`,
    );
    (async () => {
      try {
        const s = project.slug ? project.slug.split("/")[0] : projectSlug(project);
        const res = await fetch(`/api/project-history?slug=${encodeURIComponent(s)}&days=${range}`);
        setHistory(await res.json());
      } catch {
        setHistory(null);
      }
    })();
  }, [project, range, setPageContext]);

  const peers = useMemo(() => {
    if (!project) return [];
    return projects
      .filter((p) => p.category === project.category && p.id !== project.id)
      .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
      .slice(0, 8);
  }, [projects, project]);

  const rank = useMemo(() => {
    if (!project) return null;
    const sorted = projects
      .filter((p) => p.category === project.category)
      .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0));
    const idx = sorted.findIndex((p) => p.id === project.id);
    return idx >= 0 ? { rank: idx + 1, total: sorted.length } : null;
  }, [projects, project]);

  const tvlChart = useMemo(() => {
    if (!history?.history?.length) return [];
    return history.history.map((h) => ({
      label: new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: h.tvl,
    }));
  }, [history]);

  const chainRows = useMemo(() => {
    if (!history?.chainTvls) return { rows: [], series: [] as string[] };
    const entries = Object.entries(history.chainTvls)
      .filter(([k]) => !k.includes("-") && k !== "offers")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (entries.length === 0) return { rows: [], series: [] as string[] };
    const row: Record<string, string | number> = { label: "TVL by chain" };
    for (const [k, v] of entries) row[k] = Math.round(v);
    return { rows: [row], series: entries.map(([k]) => k) };
  }, [history]);

  const peerChart = useMemo(
    () => peers.map((p) => ({ label: p.name.slice(0, 10), value: p.metrics?.tvl ?? 0 })),
    [peers],
  );

  if (loading) {
    return (
      <div className="a-page">
        <div className="a-empty">Loading…</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="a-page">
        <h1 className="a-title">Protocol not found</h1>
        <p className="a-subtitle">No protocol matches “{decodeURIComponent(slug)}”.</p>
        <Link href="/analytics" style={{ color: "var(--accent)", fontSize: 13 }}>
          ← Back to Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="a-page">
      {/* Header */}
      <div className="a-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ProjectLogo src={project.logoUrl} name={project.name} size={36} />
          <h1 className="a-title">{project.name}</h1>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              border: "1px solid var(--card-border)",
              borderRadius: 999,
              padding: "2px 10px",
            }}
          >
            {project.category}
          </span>
          {rank && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              #{rank.rank} of {rank.total} in category
            </span>
          )}
        </div>
        <p className="a-subtitle">
          {project.description || `Onchain metrics, activity and charts for ${project.name}.`}
        </p>
      </div>

      {/* Range selector */}
      <div style={{ marginBottom: 20 }}>
        <div className="a-seg">
          {([30, 90, 365] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={range === r ? "active" : ""}
            >
              {r === 365 ? "1Y" : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: hero chart 8/4 + stacked KPI cards */}
      <div className="a-grid a-grid-hero">
        <div className="a-card a-span-8">
          <div className="a-card-title">{project.name}: TVL History</div>
          <div className="a-card-sub">
            Total value locked — last {range === 365 ? "year" : `${range} days`}
          </div>
          <div className="a-card-body">
            {tvlChart.length > 0 ? (
              <InsightChart data={tvlChart} type="area" height={260} formatValue={fmtUsd} />
            ) : (
              <div className="a-empty">No TVL history available for this protocol.</div>
            )}
          </div>
        </div>

        <div className="a-span-4">
          <div className="a-card a-stat">
            <div>
              <div className="a-card-title">Current TVL</div>
              <div className="a-card-sub">Latest snapshot</div>
            </div>
            <div className="a-stat-value">
              {fmtUsd(history?.currentTvl ?? project.metrics?.tvl)}
            </div>
            <div className="a-stat-label">Total value locked</div>
          </div>
          <div className="a-card a-stat">
            <div>
              <div className="a-card-title">24h Change</div>
              <div className="a-card-sub">Trailing day</div>
            </div>
            <div className="a-stat-value" style={{ color: changeColor(project.change24h) }}>
              {fmtPct(project.change24h)}
            </div>
            <div className="a-stat-label">TVL change</div>
          </div>
        </div>
      </div>

      {/* Row 2: 6/6 — chain breakdown + peer comparison */}
      <div className="a-grid a-grid-2">
        <div className="a-card">
          <div className="a-card-title">{project.name}: TVL by Chain</div>
          <div className="a-card-sub">Distribution across chains</div>
          <div className="a-card-body">
            {chainRows.series.length > 0 ? (
              <StackedBar
                data={chainRows.rows as never}
                series={chainRows.series}
                height={260}
                formatValue={fmtUsd}
              />
            ) : (
              <div className="a-empty">Single-chain protocol — no breakdown.</div>
            )}
          </div>
        </div>

        <div className="a-card">
          <div className="a-card-title">{project.category}: Peer Comparison</div>
          <div className="a-card-sub">Top protocols by TVL in this category</div>
          <div className="a-card-body">
            {peerChart.length > 0 ? (
              <InsightChart data={peerChart} type="bar" height={260} formatValue={fmtUsd} />
            ) : (
              <div className="a-empty">No peers in this category.</div>
            )}
          </div>
        </div>
      </div>

      {/* Peer leaderboard */}
      {peers.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 590,
              letterSpacing: "0.02em",
              color: "var(--text-secondary)",
              marginBottom: 14,
            }}
          >
            Category leaderboard
          </div>
          <table className="t-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", borderBottom: "1px solid var(--card-border)" }}>#</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", borderBottom: "1px solid var(--card-border)" }}>Name</th>
                <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", borderBottom: "1px solid var(--card-border)" }}>TVL</th>
                <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", borderBottom: "1px solid var(--card-border)" }}>Volume 24h</th>
              </tr>
            </thead>
            <tbody>
              {peers.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--card-border)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--card-border)" }}>
                    <Link
                      href={`/analytics/${encodeURIComponent(projectSlug(p))}`}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)" }}
                    >
                      <ProjectLogo src={p.logoUrl} name={p.name} size={16} />
                      {p.name}
                    </Link>
                  </td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--card-border)", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{fmtUsd(p.metrics?.tvl)}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--card-border)", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{fmtUsd(p.metrics?.volume24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="a-note">
        Source: DeFiLlama · TVL history &amp; chain breakdown from live protocol API
      </div>
    </div>
  );
}
