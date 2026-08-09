"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface Snapshot {
  id: string;
  referenceDate: string;
  summary: {
    projectCount: number;
    narrativeCount: number;
    evidenceCount: number;
    graphEntityCount: number;
  };
}

interface HistoryDiff {
  addedProjects: string[];
  removedProjects: string[];
  changedProjects: { id: string; name: string; changes: string[] }[];
  addedNarratives: string[];
  removedNarratives: string[];
  evidenceDelta: number;
}

type LoadState = "idle" | "loading" | "success" | "error";

export default function HistoryPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [diff, setDiff] = useState<HistoryDiff | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [error, setError] = useState("");

  const loadSnapshots = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/snapshots");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { snapshots: Snapshot[] };
      setSnapshots(json.snapshots ?? []);
      if (json.snapshots && json.snapshots.length >= 2) {
        setFromId(json.snapshots[0]!.id);
        setToId(json.snapshots[json.snapshots.length - 1]!.id);
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

  const compare = useCallback(async () => {
    if (!fromId || !toId) return;
    setDiff(null);
    try {
      const res = await fetch(`/api/history?from=${fromId}&to=${toId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { diff: HistoryDiff };
      setDiff(json.diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [fromId, toId]);

  return (
    <div className="page">
      <nav className="nav" aria-label="Primary navigation">
        <Link href="/" className="nav-brand">
          Insight
        </Link>
        <div className="nav-links">
          <Link href="/projects">Projects</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <span className="nav-active">History</span>
          <Link href="/saved">Saved</Link>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <main className="hero">
        <h1>Snapshot History</h1>
        <p className="subtitle">
          Compare data snapshots to see how the ecosystem has changed over time.
        </p>

        {state === "loading" && <p className="muted">Loading snapshots...</p>}

        {state === "error" && <div className="auth-error">{error}</div>}

        {state === "success" && snapshots.length === 0 && (
          <div className="saved-card">
            <h3>No snapshots yet</h3>
            <p className="muted">
              Take a snapshot from the dashboard or trigger a refresh to start tracking changes.
            </p>
            <Link href="/api/refresh" className="primary-button inline-button">
              Trigger refresh
            </Link>
          </div>
        )}

        {state === "success" && snapshots.length > 0 && (
          <>
            <div className="saved-card">
              <h3>Snapshots ({snapshots.length})</h3>
              <ul className="ref-list">
                {snapshots.map((s) => (
                  <li key={s.id}>
                    <strong>{s.id}</strong>
                    <span className="ref-desc">
                      {s.referenceDate} · {s.summary.projectCount} projects ·{" "}
                      {s.summary.narrativeCount} narratives · {s.summary.evidenceCount} evidence
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {snapshots.length >= 2 && (
              <div className="saved-card" style={{ marginTop: 16 }}>
                <h3>Compare snapshots</h3>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <label className="form-label">
                    From
                    <select
                      className="form-input"
                      value={fromId}
                      onChange={(e) => setFromId(e.target.value)}
                    >
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.id} ({s.referenceDate})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-label">
                    To
                    <select
                      className="form-input"
                      value={toId}
                      onChange={(e) => setToId(e.target.value)}
                    >
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.id} ({s.referenceDate})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    onClick={() => void compare()}
                    disabled={fromId === toId}
                  >
                    Compare
                  </button>
                </div>
              </div>
            )}

            {diff && (
              <div className="saved-card" style={{ marginTop: 16 }}>
                <h3>Differences</h3>
                {diff.addedProjects.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong className="diff-added">
                      Added projects (+{diff.addedProjects.length})
                    </strong>
                    <ul className="ref-list">
                      {diff.addedProjects.map((id) => (
                        <li key={id}>{id}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diff.removedProjects.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong className="diff-removed">
                      Removed projects (-{diff.removedProjects.length})
                    </strong>
                    <ul className="ref-list">
                      {diff.removedProjects.map((id) => (
                        <li key={id}>{id}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diff.changedProjects.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>Changed projects ({diff.changedProjects.length})</strong>
                    <ul className="ref-list">
                      {diff.changedProjects.map((c) => (
                        <li key={c.id}>
                          <strong>{c.name}</strong>
                          <span className="ref-desc">{c.changes.join(", ")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {diff.addedProjects.length === 0 &&
                  diff.removedProjects.length === 0 &&
                  diff.changedProjects.length === 0 && (
                    <p className="muted">No project changes between these snapshots.</p>
                  )}
                <div className="diff-meta">
                  <span>
                    Evidence delta: {diff.evidenceDelta >= 0 ? "+" : ""}
                    {diff.evidenceDelta}
                  </span>
                  <span>
                    Narratives: +{diff.addedNarratives.length} / -{diff.removedNarratives.length}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
