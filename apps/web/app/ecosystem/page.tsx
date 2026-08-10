"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ProjectLogo } from "../../components/ProjectLogo";
import { useCopilot } from "../../components/Copilot";
import { InsightChart } from "../../components/InsightChart";

interface Project {
  id: string;
  name: string;
  category: string;
  description: string;
  metrics: { tvl?: number; volume24h?: number };
  logoUrl?: string;
  change24h?: number;
  classification?: string;
  website?: string;
}
interface Narrative {
  id: string;
  name: string;
  trend: string;
  note: string;
}

function fmtUsd(v: number | undefined): string {
  if (!v) return "\u2014";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

export default function EcosystemPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Ecosystem] Solana ecosystem universe with project directory, category taxonomy, and narratives.",
    );
  }, [setPageContext]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [pRes, nRes] = await Promise.all([
        fetch("/api/projects?classification=solana_ecosystem")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
        fetch("/api/narratives")
          .then((r) => r.json())
          .catch(() => ({ narratives: [] })),
      ]);
      setProjects(pRes.projects ?? []);
      setNarratives(nRes.narratives ?? []);
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
    .filter((p) => filter === "all" || p.category === filter)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0));

  const catCounts = categories
    .filter((c) => c !== "all")
    .map((c) => ({
      label: c,
      value: eco.filter((p) => p.category === c).length,
    }))
    .sort((a, b) => b.value - a.value);

  const totalTvl = eco.reduce((s, p) => s + (p.metrics?.tvl ?? 0), 0);

  return (
    <div style={{ background: "var(--linen)", minHeight: "100vh" }}>
      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "32px 24px 16px" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            fontWeight: 700,
            margin: 0,
            color: "var(--text)",
          }}
        >
          Solana Ecosystem
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 4 }}>
          {eco.length} indexed projects \u00b7 {categories.length - 1} categories \u00b7{" "}
          {fmtUsd(totalTvl)} total TVL
        </p>
      </div>

      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 24px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            Loading ecosystem...
          </div>
        )}

        {!loading && (
          <>
            {/* Category distribution chart */}
            {catCounts.length > 0 && (
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  Category Distribution
                </div>
                <InsightChart
                  data={catCounts.slice(0, 12)}
                  type="bar"
                  color="var(--brown)"
                  height={180}
                  formatValue={(v) => `${v}`}
                />
              </div>
            )}

            {/* Narratives */}
            {narratives.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  Active Narratives
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 8,
                  }}
                >
                  {narratives.slice(0, 8).map((n) => (
                    <Link
                      href={`/narratives/${n.id}`}
                      key={n.id}
                      style={{
                        padding: "10px 12px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        textDecoration: "none",
                        display: "block",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                          {n.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                            background:
                              n.trend === "up" ? "rgba(5,150,105,0.1)" : "var(--bg-hover)",
                            color: n.trend === "up" ? "var(--green)" : "var(--text-muted)",
                          }}
                        >
                          {n.trend}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        {n.note}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                placeholder="Search protocols..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: "8px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  color: "var(--text)",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {categories.slice(0, 15).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    background: filter === c ? "var(--brown)" : "var(--bg-card)",
                    color: filter === c ? "#fff" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                  }}
                >
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>

            {/* Project grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 10,
              }}
            >
              {filtered.slice(0, 60).map((p) => (
                <Link
                  href={`/projects/${p.id}`}
                  key={p.id}
                  style={{
                    padding: 12,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    textDecoration: "none",
                    display: "block",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <ProjectLogo src={p.logoUrl} name={p.name} size={24} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                      {p.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                    {p.category}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span>TVL: {fmtUsd(p.metrics?.tvl)}</span>
                    {p.change24h !== undefined && (
                      <span style={{ color: p.change24h >= 0 ? "var(--green)" : "var(--red)" }}>
                        {p.change24h >= 0 ? "+" : ""}
                        {p.change24h.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            {filtered.length > 60 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Showing 60 of {filtered.length} projects.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
