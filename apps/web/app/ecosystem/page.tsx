"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";

interface Project {
  id: string;
  name: string;
  category: string;
  description: string;
  metrics: { tvl?: number; volume24h?: number };
  classification?: string;
}

interface Narrative {
  id: string;
  name: string;
  trend: string;
  change?: string;
  note: string;
  projectIds: string[];
}

function fmtTvl(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

export default function EcosystemPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Ecosystem] User is viewing the Solana ecosystem universe with project listings, category filters, and narratives.",
    );
  }, [setPageContext]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const [pRes, nRes] = await Promise.all([
        fetch("/api/projects")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
        fetch("/api/narratives")
          .then((r) => r.json())
          .catch(() => ({ narratives: [] })),
      ]);
      // Defensive: filter to solana_ecosystem only — exclude market_context and network
      setProjects(
        (pRes.projects ?? []).filter(
          (p: Project) =>
            p.classification === undefined || p.classification === "solana_ecosystem",
        ),
      );
      setNarratives(nRes.narratives ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = ["all", ...new Set(projects.map((p) => p.category))];
  const filtered = filter === "all" ? projects : projects.filter((p) => p.category === filter);

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">ECOSYSTEM</p>
        <h1 style={{ fontSize: 32 }}>Solana ecosystem universe</h1>
        <p className="subtitle">
          {projects.length} indexed projects across {categories.length - 1} categories
        </p>
      </div>

      <div className="terminal-main">
        {loading && <div className="t-loading">Loading ecosystem...</div>}

        {!loading && (
          <>
            {/* Narratives */}
            <div className="terminal-section">
              <div className="section-header">
                <div className="section-title">Narratives</div>
              </div>
              <div className="terminal-grid terminal-grid-3">
                {narratives.map((n) => (
                  <Link
                    href={`/narratives/${n.id}`}
                    key={n.id}
                    className="t-card"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="t-card-title">{n.name}</span>
                      <span className={`trend-badge trend-${n.trend}`}>{n.trend}</span>
                    </div>
                    <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                      {n.note}
                    </p>
                    {n.change && <span className="text-xs text-muted mt-2">{n.change}</span>}
                  </Link>
                ))}
              </div>
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-4 mb-4">
              <div className="timeframe-controls">
                {categories.map((c) => (
                  <button
                    key={c}
                    className={`timeframe-btn ${filter === c ? "active" : ""}`}
                    onClick={() => setFilter(c)}
                  >
                    {c === "all" ? "All Sectors" : c}
                  </button>
                ))}
              </div>
            </div>

            {/* Project grid */}
            <div className="project-grid">
              {filtered.slice(0, 60).map((p) => (
                <Link href={`/projects/${p.id}`} key={p.id} className="project-card-link">
                  <article className="project-card">
                    <div className="project-card-header">
                      <h3>{p.name}</h3>
                      <span className="category-badge">{p.category}</span>
                    </div>
                    <p className="project-description">{p.description}</p>
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs text-muted">TVL: {fmtTvl(p.metrics.tvl)}</span>
                      <span className="text-xs text-muted">Vol: {fmtTvl(p.metrics.volume24h)}</span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
            {filtered.length > 60 && (
              <p className="text-sm text-muted mt-4">
                Showing 60 of {filtered.length} projects. Use search to find more.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
