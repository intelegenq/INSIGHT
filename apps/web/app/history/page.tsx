"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface SnapshotSummary {
  projectCount: number;
  narrativeCount: number;
  evidenceCount: number;
  graphEntityCount: number;
}

interface Snapshot {
  id: string;
  referenceDate: string;
  createdAt?: string;
  summary: SnapshotSummary;
}

interface ProjectMetricChange {
  metric: string;
  from: number | undefined;
  to: number | undefined;
  delta: number | undefined;
  direction: "increased" | "decreased" | "unchanged";
}

interface ProjectChange {
  projectId: string;
  name: string;
  category: string;
  metrics: ProjectMetricChange[];
  descriptionChanged: boolean;
}

interface NarrativeChange {
  narrativeId: string;
  name: string;
  fromTrend: string | undefined;
  toTrend: string | undefined;
  trendChange: string;
  noteChanged: boolean;
}

interface HistorySummary {
  addedProjects: number;
  removedProjects: number;
  commonProjects: number;
  changedProjects: number;
  changedNarratives: number;
}

interface HistoryDiff {
  fromId: string;
  toId: string;
  fromReferenceDate: string;
  toReferenceDate: string;
  projects: ProjectChange[];
  narratives: NarrativeChange[];
  summary: HistorySummary;
}

type LoadState = "idle" | "loading" | "success" | "error";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatMetricValue(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function directionArrow(dir: string): string {
  switch (dir) {
    case "increased":
      return "↑";
    case "decreased":
      return "↓";
    default:
      return "→";
  }
}

function directionClass(dir: string): string {
  switch (dir) {
    case "increased":
      return "tl-diff-up";
    case "decreased":
      return "tl-diff-down";
    default:
      return "tl-diff-flat";
  }
}

export default function HistoryPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [compareId, setCompareId] = useState<string>("");
  const [diff, setDiff] = useState<HistoryDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSnapshots = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/snapshots");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { snapshots: Snapshot[] };
      const sorted = [...(json.snapshots ?? [])].sort(
        (a, b) => new Date(a.referenceDate).getTime() - new Date(b.referenceDate).getTime(),
      );
      setSnapshots(sorted);
      if (sorted.length > 0) {
        setSelectedId(sorted[sorted.length - 1]!.id);
        if (sorted.length >= 2) {
          setCompareId(sorted[sorted.length - 2]!.id);
        }
      }
      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const selected = snapshots.find((s) => s.id === selectedId);
  const compare = snapshots.find((s) => s.id === compareId);

  const runCompare = useCallback(async () => {
    if (!compareId || !selectedId || compareId === selectedId) return;
    setDiffLoading(true);
    setDiff(null);
    try {
      const res = await fetch(`/api/history?from=${compareId}&to=${selectedId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { diff: HistoryDiff };
      setDiff(json.diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setDiffLoading(false);
    }
  }, [compareId, selectedId]);

  // Auto-run comparison when both selected
  useEffect(() => {
    if (compareId && selectedId && compareId !== selectedId) {
      void runCompare();
    } else {
      setDiff(null);
    }
  }, [compareId, selectedId, runCompare]);

  // Compute delta metrics between selected and compare snapshots
  const snapshotDeltas =
    selected && compare
      ? {
          projects: selected.summary.projectCount - compare.summary.projectCount,
          narratives: selected.summary.narrativeCount - compare.summary.narrativeCount,
          evidence: selected.summary.evidenceCount - compare.summary.evidenceCount,
          graph: selected.summary.graphEntityCount - compare.summary.graphEntityCount,
        }
      : null;

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
          <span className="nav-active">History</span>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <section className="hero timeline-hero">
        <p className="eyebrow">SNAPSHOT HISTORY</p>
        <h1>
          Ecosystem changes,
          <br />
          <em>over time.</em>
        </h1>
        <p className="hero-copy">
          Browse chronological snapshots, inspect key metrics at each point in time, and compare how
          the ecosystem evolved between captures.
        </p>
      </section>

      {state === "loading" && (
        <section className="section">
          <p className="search-status">Loading snapshots…</p>
        </section>
      )}

      {state === "error" && (
        <section className="section">
          <p className="search-error">{error}</p>
        </section>
      )}

      {state === "success" && snapshots.length === 0 && (
        <section className="section">
          <div className="tl-empty">
            <p className="search-status">No snapshots yet.</p>
            <p className="search-status">
              Trigger a refresh or take a snapshot from the dashboard to start tracking changes.
            </p>
            <Link className="primary-button" href="/api/refresh">
              Trigger refresh
            </Link>
          </div>
        </section>
      )}

      {state === "success" && snapshots.length > 0 && (
        <>
          {/* Timeline Rail */}
          <section className="section" aria-labelledby="timeline-rail-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TIMELINE</p>
                <h2 id="timeline-rail-title">
                  {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
                </h2>
              </div>
              {snapshots.length >= 2 && (
                <span className="as-of">
                  From {formatDate(snapshots[0]!.referenceDate)} to{" "}
                  {formatDate(snapshots[snapshots.length - 1]!.referenceDate)}
                </span>
              )}
            </div>

            <div className="tl-rail" role="list">
              {snapshots.map((snap, i) => {
                const isSelected = snap.id === selectedId;
                const isCompare = snap.id === compareId;
                const prev = i > 0 ? snapshots[i - 1] : null;
                const projectDelta = prev
                  ? snap.summary.projectCount - prev.summary.projectCount
                  : 0;
                return (
                  <button
                    key={snap.id}
                    className={`tl-node ${isSelected ? "tl-node-selected" : ""} ${isCompare ? "tl-node-compare" : ""}`}
                    onClick={() => setSelectedId(snap.id)}
                    role="listitem"
                    aria-label={`Snapshot ${formatDate(snap.referenceDate)}`}
                  >
                    <span className="tl-node-dot" />
                    <span className="tl-node-date">{formatDate(snap.referenceDate)}</span>
                    <span className="tl-node-meta">
                      {snap.summary.projectCount} projects
                      {prev && projectDelta !== 0 && (
                        <span
                          className={`tl-node-delta ${projectDelta > 0 ? "tl-diff-up" : "tl-diff-down"}`}
                        >
                          {projectDelta > 0 ? "+" : ""}
                          {projectDelta}
                        </span>
                      )}
                    </span>
                    {isCompare && !isSelected && (
                      <span className="tl-node-badge">compare base</span>
                    )}
                    {isSelected && (
                      <span className="tl-node-badge tl-node-badge-selected">selected</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Snapshot Detail */}
          {selected && (
            <section className="section" aria-labelledby="snapshot-detail-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SELECTED SNAPSHOT</p>
                  <h2 id="snapshot-detail-title">{formatDate(selected.referenceDate)}</h2>
                </div>
                <code className="tl-snapshot-id">{selected.id}</code>
              </div>

              <div className="metric-grid">
                <article className="metric-card">
                  <span>Projects</span>
                  <strong>{selected.summary.projectCount}</strong>
                  <small>Tracked protocols</small>
                </article>
                <article className="metric-card violet">
                  <span>Narratives</span>
                  <strong>{selected.summary.narrativeCount}</strong>
                  <small>Surfaced themes</small>
                </article>
                <article className="metric-card">
                  <span>Evidence</span>
                  <strong>{selected.summary.evidenceCount}</strong>
                  <small>Citable signals</small>
                </article>
                <article className="metric-card">
                  <span>Graph Entities</span>
                  <strong>{selected.summary.graphEntityCount}</strong>
                  <small>Knowledge graph nodes</small>
                </article>
              </div>

              {/* Delta vs compare base */}
              {snapshotDeltas && (
                <div className="tl-delta-bar">
                  <span className="eyebrow">CHANGE vs COMPARE BASE</span>
                  <div className="tl-delta-grid">
                    <div className="tl-delta-item">
                      <span className="tl-delta-label">Projects</span>
                      <span
                        className={`tl-delta-value ${snapshotDeltas.projects > 0 ? "tl-diff-up" : snapshotDeltas.projects < 0 ? "tl-diff-down" : "tl-diff-flat"}`}
                      >
                        {snapshotDeltas.projects > 0 ? "+" : ""}
                        {snapshotDeltas.projects}
                      </span>
                    </div>
                    <div className="tl-delta-item">
                      <span className="tl-delta-label">Narratives</span>
                      <span
                        className={`tl-delta-value ${snapshotDeltas.narratives > 0 ? "tl-diff-up" : snapshotDeltas.narratives < 0 ? "tl-diff-down" : "tl-diff-flat"}`}
                      >
                        {snapshotDeltas.narratives > 0 ? "+" : ""}
                        {snapshotDeltas.narratives}
                      </span>
                    </div>
                    <div className="tl-delta-item">
                      <span className="tl-delta-label">Evidence</span>
                      <span
                        className={`tl-delta-value ${snapshotDeltas.evidence > 0 ? "tl-diff-up" : snapshotDeltas.evidence < 0 ? "tl-diff-down" : "tl-diff-flat"}`}
                      >
                        {snapshotDeltas.evidence > 0 ? "+" : ""}
                        {snapshotDeltas.evidence}
                      </span>
                    </div>
                    <div className="tl-delta-item">
                      <span className="tl-delta-label">Graph</span>
                      <span
                        className={`tl-delta-value ${snapshotDeltas.graph > 0 ? "tl-diff-up" : snapshotDeltas.graph < 0 ? "tl-diff-down" : "tl-diff-flat"}`}
                      >
                        {snapshotDeltas.graph > 0 ? "+" : ""}
                        {snapshotDeltas.graph}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Compare base selector */}
              {snapshots.length >= 2 && (
                <div className="tl-compare-selector">
                  <label className="form-label">
                    Compare against
                    <select
                      className="form-input"
                      value={compareId}
                      onChange={(e) => setCompareId(e.target.value)}
                    >
                      {snapshots
                        .filter((s) => s.id !== selectedId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatDate(s.referenceDate)} — {s.id.slice(0, 20)}…
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              )}
            </section>
          )}

          {/* Diff Detail */}
          {diffLoading && (
            <section className="section">
              <p className="search-status">Computing diff…</p>
            </section>
          )}

          {diff && !diffLoading && (
            <section className="section" aria-labelledby="diff-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CHANGES</p>
                  <h2 id="diff-title">
                    {formatDate(diff.fromReferenceDate)} → {formatDate(diff.toReferenceDate)}
                  </h2>
                </div>
              </div>

              {/* Summary counts */}
              <div className="tl-diff-summary">
                <div className={`tl-diff-count tl-diff-up`}>
                  <span className="tl-diff-count-num">+{diff.summary.addedProjects}</span>
                  <span className="tl-diff-count-label">Projects added</span>
                </div>
                <div className={`tl-diff-count tl-diff-down`}>
                  <span className="tl-diff-count-num">−{diff.summary.removedProjects}</span>
                  <span className="tl-diff-count-label">Projects removed</span>
                </div>
                <div className="tl-diff-count">
                  <span className="tl-diff-count-num">{diff.summary.changedProjects}</span>
                  <span className="tl-diff-count-label">Projects changed</span>
                </div>
                <div className="tl-diff-count">
                  <span className="tl-diff-count-num">{diff.summary.changedNarratives}</span>
                  <span className="tl-diff-count-label">Narratives changed</span>
                </div>
              </div>

              {/* Project changes */}
              {diff.projects.length > 0 && (
                <div className="tl-diff-group">
                  <h3 className="search-group-title">
                    Project metric changes ({diff.projects.length})
                  </h3>
                  <div className="compare-table-wrap">
                    <table className="compare-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Metric</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.projects.flatMap((p) =>
                          p.metrics.length === 0
                            ? [
                                <tr key={`${p.projectId}-desc`}>
                                  <td>{p.name}</td>
                                  <td className="compare-row-label">description</td>
                                  <td
                                    colSpan={3}
                                    className={p.descriptionChanged ? "tl-diff-up" : ""}
                                  >
                                    {p.descriptionChanged ? "changed" : "—"}
                                  </td>
                                </tr>,
                              ]
                            : p.metrics.map((m) => (
                                <tr key={`${p.projectId}-${m.metric}`}>
                                  <td>{p.name}</td>
                                  <td className="compare-row-label">{m.metric}</td>
                                  <td>{formatMetricValue(m.from)}</td>
                                  <td>{formatMetricValue(m.to)}</td>
                                  <td className={directionClass(m.direction)}>
                                    {directionArrow(m.direction)}
                                    {m.delta !== undefined
                                      ? ` ${m.delta > 0 ? "+" : ""}${formatMetricValue(m.delta)}`
                                      : ""}
                                  </td>
                                </tr>
                              )),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Narrative changes */}
              {diff.narratives.length > 0 && (
                <div className="tl-diff-group">
                  <h3 className="search-group-title">
                    Narrative changes ({diff.narratives.length})
                  </h3>
                  <div className="compare-table-wrap">
                    <table className="compare-table">
                      <thead>
                        <tr>
                          <th>Narrative</th>
                          <th>From Trend</th>
                          <th>To Trend</th>
                          <th>Change</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.narratives.map((n) => (
                          <tr key={n.narrativeId}>
                            <td>{n.name}</td>
                            <td>{n.fromTrend ?? "—"}</td>
                            <td>{n.toTrend ?? "—"}</td>
                            <td
                              className={directionClass(
                                n.trendChange === "trend-shifted"
                                  ? "increased"
                                  : n.trendChange === "appeared"
                                    ? "increased"
                                    : n.trendChange === "disappeared"
                                      ? "decreased"
                                      : "unchanged",
                              )}
                            >
                              {n.trendChange}
                            </td>
                            <td>{n.noteChanged ? "changed" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {diff.projects.length === 0 && diff.narratives.length === 0 && (
                <p className="search-status">No changes detected between these snapshots.</p>
              )}
            </section>
          )}

          {/* Navigation between snapshots */}
          <section className="section tl-nav-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">NAVIGATE</p>
                <h2>Browse historical states</h2>
              </div>
            </div>
            <div className="tl-nav-buttons">
              <button
                className="ghost-button"
                onClick={() => {
                  const idx = snapshots.findIndex((s) => s.id === selectedId);
                  if (idx > 0) {
                    setSelectedId(snapshots[idx - 1]!.id);
                  }
                }}
                disabled={snapshots.findIndex((s) => s.id === selectedId) === 0}
              >
                ← Earlier
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  const idx = snapshots.findIndex((s) => s.id === selectedId);
                  if (idx >= 0 && idx < snapshots.length - 1) {
                    setSelectedId(snapshots[idx + 1]!.id);
                  }
                }}
                disabled={snapshots.findIndex((s) => s.id === selectedId) === snapshots.length - 1}
              >
                Later →
              </button>
            </div>
          </section>
        </>
      )}

      {state === "idle" && (
        <section className="section">
          <p className="search-status">Loading…</p>
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
