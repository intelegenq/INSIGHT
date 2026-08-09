"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";

interface ProjectMetrics {
  tvl?: number;
  volume24h?: number;
  activeUsers24h?: number;
  developerActivity?: number;
}

interface ProjectHealth {
  health: number;
  momentum: number;
  risk: number;
  developer: number;
}

interface ComparisonEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  metrics: ProjectMetrics;
  health?: ProjectHealth;
  evidenceCount: number;
}

interface CompareResponse {
  entries: ComparisonEntry[];
  count: number;
  notFound?: string[];
}

interface ProjectOption {
  id: string;
  name: string;
  category: string;
}

type LoadState = "idle" | "loading" | "success" | "error";

function formatMetric(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value === 0) return "0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatScore(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toFixed(1);
}

function bestValue(values: (number | undefined)[], higherIsBetter: boolean): number | undefined {
  const defined = values.filter((v): v is number => v !== undefined);
  if (defined.length === 0) return undefined;
  return higherIsBetter ? Math.max(...defined) : Math.min(...defined);
}

export default function ComparePage() {
  const [availableProjects, setAvailableProjects] = useState<ProjectOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<CompareResponse | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  // Load available projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data = (await res.json()) as { projects: ProjectOption[] };
        setAvailableProjects(data.projects);
        // Read IDs from URL on mount
        const params = new URLSearchParams(window.location.search);
        const idsParam = params.get("ids");
        if (idsParam) {
          const ids = idsParam.split(",").filter((id) => id.length > 0);
          if (ids.length >= 2) {
            setSelectedIds(ids);
            void runCompare(ids);
          }
        }
      } catch {
        // ignore
      }
    }
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCompare = useCallback(async (ids: string[]) => {
    if (ids.length < 2) {
      setState("idle");
      setResults(null);
      return;
    }
    setState("loading");
    setError("");
    try {
      const res = await fetch(`/api/compare?ids=${ids.join(",")}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CompareResponse;
      setResults(data);
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Comparison failed");
    }
  }, []);

  const toggleProject = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      void runCompare(next);
      return next;
    });
  };

  const tvls = results?.entries.map((e) => e.metrics.tvl) ?? [];
  const volumes = results?.entries.map((e) => e.metrics.volume24h) ?? [];
  const users = results?.entries.map((e) => e.metrics.activeUsers24h) ?? [];
  const devActivity = results?.entries.map((e) => e.metrics.developerActivity) ?? [];
  const healthScores = results?.entries.map((e) => e.health?.health) ?? [];
  const momentumScores = results?.entries.map((e) => e.health?.momentum) ?? [];
  const riskScores = results?.entries.map((e) => e.health?.risk) ?? [];
  const devScores = results?.entries.map((e) => e.health?.developer) ?? [];

  const bestTvl = bestValue(tvls, true);
  const bestVolume = bestValue(volumes, true);
  const bestUsers = bestValue(users, true);
  const bestDevActivity = bestValue(devActivity, true);
  const bestHealth = bestValue(healthScores, true);
  const bestMomentum = bestValue(momentumScores, true);
  const bestRisk = bestValue(riskScores, false);
  const bestDevScore = bestValue(devScores, true);

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <div className="nav-links">
          <Link href="/#pulse">Pulse</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/graph">Graph</Link>
          <Link href="/health">Health</Link>
          <Link href="/history">History</Link>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
        </div>
        <Link className="ghost-button" href="/reports">
          Research mode <span>↗</span>
        </Link>
      </nav>

      <section className="hero compare-hero">
        <p className="eyebrow">CROSS-ENTITY COMPARISON</p>
        <h1>
          Compare protocols
          <br />
          <em>side by side.</em>
        </h1>
        <p className="hero-copy">
          Select two or more projects to compare their metrics, health scores, and evidence
          coverage. All values are derived deterministically from Insight&apos;s data contracts.
        </p>
      </section>

      <section className="section" aria-labelledby="selector-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SELECT</p>
            <h2 id="selector-title">Choose projects to compare</h2>
          </div>
          {selectedIds.length > 0 && <span className="as-of">{selectedIds.length} selected</span>}
        </div>
        <div className="compare-selector">
          {availableProjects.map((p) => (
            <label
              key={p.id}
              className={`compare-option ${selectedIds.includes(p.id) ? "selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={() => toggleProject(p.id)}
              />
              <span className="compare-option-name">{p.name}</span>
              <span className="category-badge">{p.category}</span>
            </label>
          ))}
        </div>
        {selectedIds.length > 0 && selectedIds.length < 2 && (
          <p className="search-status">Select at least 2 projects to compare.</p>
        )}
      </section>

      {state === "loading" && (
        <section className="section">
          <p className="search-status">Comparing…</p>
        </section>
      )}

      {state === "error" && (
        <section className="section">
          <p className="search-error">{error}</p>
        </section>
      )}

      {state === "success" && results && results.entries.length >= 2 && (
        <section className="section" aria-labelledby="comparison-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">COMPARISON</p>
              <h2 id="comparison-title">{results.entries.length} projects side by side</h2>
            </div>
          </div>

          {results.notFound && results.notFound.length > 0 && (
            <p className="search-error">Not found: {results.notFound.join(", ")}</p>
          )}

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="compare-row-label">Metric</th>
                  {results.entries.map((e) => (
                    <th key={e.id} className="compare-col-header">
                      <Link href={`/projects/${e.id}`}>{e.name}</Link>
                      <span className="category-badge">{e.category}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="compare-row-label">Description</td>
                  {results.entries.map((e) => (
                    <td key={e.id} className="compare-cell">
                      {e.description}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-row-label">TVL</td>
                  {results.entries.map((e) => (
                    <td
                      key={e.id}
                      className={`compare-cell ${e.metrics.tvl === bestTvl && bestTvl !== undefined && bestTvl > 0 ? "compare-best" : ""}`}
                    >
                      {formatMetric(e.metrics.tvl)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-row-label">24h Volume</td>
                  {results.entries.map((e) => (
                    <td
                      key={e.id}
                      className={`compare-cell ${e.metrics.volume24h === bestVolume && bestVolume !== undefined && bestVolume > 0 ? "compare-best" : ""}`}
                    >
                      {formatMetric(e.metrics.volume24h)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-row-label">Active Users (24h)</td>
                  {results.entries.map((e) => (
                    <td
                      key={e.id}
                      className={`compare-cell ${e.metrics.activeUsers24h === bestUsers && bestUsers !== undefined && bestUsers > 0 ? "compare-best" : ""}`}
                    >
                      {e.metrics.activeUsers24h !== undefined
                        ? e.metrics.activeUsers24h.toLocaleString()
                        : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-row-label">Dev Activity</td>
                  {results.entries.map((e) => (
                    <td
                      key={e.id}
                      className={`compare-cell ${e.metrics.developerActivity === bestDevActivity && bestDevActivity !== undefined && bestDevActivity > 0 ? "compare-best" : ""}`}
                    >
                      {e.metrics.developerActivity !== undefined
                        ? e.metrics.developerActivity
                        : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-row-label">Evidence Count</td>
                  {results.entries.map((e) => (
                    <td key={e.id} className="compare-cell">
                      {e.evidenceCount}
                    </td>
                  ))}
                </tr>
              </tbody>
              {results.entries.some((e) => e.health !== undefined) && (
                <tbody className="compare-health-group">
                  <tr className="compare-group-header">
                    <td colSpan={results.entries.length + 1}>Health Scores</td>
                  </tr>
                  <tr>
                    <td className="compare-row-label">Health (0–100)</td>
                    {results.entries.map((e) => (
                      <td
                        key={e.id}
                        className={`compare-cell ${e.health?.health === bestHealth && bestHealth !== undefined ? "compare-best" : ""}`}
                      >
                        {formatScore(e.health?.health)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="compare-row-label">Momentum (−100 to +100)</td>
                    {results.entries.map((e) => (
                      <td
                        key={e.id}
                        className={`compare-cell ${e.health?.momentum === bestMomentum && bestMomentum !== undefined ? "compare-best" : ""}`}
                      >
                        {e.health && e.health.momentum > 0 ? "+" : ""}
                        {formatScore(e.health?.momentum)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="compare-row-label">Risk (0–100)</td>
                    {results.entries.map((e) => (
                      <td
                        key={e.id}
                        className={`compare-cell ${e.health?.risk === bestRisk && bestRisk !== undefined ? "compare-best" : ""}`}
                      >
                        {formatScore(e.health?.risk)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="compare-row-label">Developer (0–100)</td>
                    {results.entries.map((e) => (
                      <td
                        key={e.id}
                        className={`compare-cell ${e.health?.developer === bestDevScore && bestDevScore !== undefined ? "compare-best" : ""}`}
                      >
                        {formatScore(e.health?.developer)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        </section>
      )}

      {state === "idle" && (
        <section className="section" aria-labelledby="compare-tips-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HOW IT WORKS</p>
              <h2 id="compare-tips-title">Cross-entity comparison</h2>
            </div>
          </div>
          <div className="metric-grid">
            <article className="metric-card">
              <span>Metrics</span>
              <strong style={{ fontSize: "24px" }}>TVL, volume, users, dev</strong>
              <small>Side-by-side traction indicators with best-value highlighting</small>
            </article>
            <article className="metric-card violet">
              <span>Health</span>
              <strong style={{ fontSize: "24px" }}>4 bounded scores</strong>
              <small>Health, momentum, risk, and developer velocity</small>
            </article>
            <article className="metric-card">
              <span>Evidence</span>
              <strong style={{ fontSize: "24px" }}>Coverage count</strong>
              <small>How many evidence items back each project</small>
            </article>
          </div>
        </section>
      )}

      <footer>
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <p>Built for better questions about Solana.</p>
        <p>© 2026 Insight</p>
      </footer>
    </main>
  );
}
