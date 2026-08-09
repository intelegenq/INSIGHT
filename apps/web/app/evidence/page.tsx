"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface EvidenceItem {
  evidence: {
    id: string;
    source: { id: string; name: string; chain?: string };
    note: string;
    status: string;
    observedAt: string;
    reference?: string;
    chain?: string;
  };
  projectIds: string[];
  narrativeIds: string[];
  snapshotId: string;
}

interface TimelineResponse {
  evidence: EvidenceItem[];
  count: number;
}

type LoadState = "idle" | "loading" | "success" | "error";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function EvidenceTimelinePage() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("sourceId", sourceFilter);
      const qs = params.toString();
      const res = await fetch(`/api/evidence/timeline${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as TimelineResponse;
      setItems(data.evidence);
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to load evidence timeline");
    }
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = [...new Set(items.map((i) => i.evidence.source.id))];

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <div className="nav-links">
          <Link href="/projects">Projects</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/graph">Graph</Link>
          <Link href="/health">Health</Link>
          <Link href="/history">History</Link>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/trends">Trends</Link>
          <span className="nav-active">Evidence</span>
        </div>
        <Link className="ghost-button" href="/reports">
          Research mode <span>↗</span>
        </Link>
      </nav>

      <section className="hero search-hero">
        <p className="eyebrow">EVIDENCE TIMELINE</p>
        <h1>
          Every signal,
          <br />
          <em>chronologically.</em>
        </h1>
        <p className="hero-copy">
          All evidence across all snapshots, sorted by observation date. Filter by status or source.
          Each entry links to associated projects and narratives.
        </p>
      </section>

      <section className="section">
        <div className="ev-timeline-filter">
          <label>
            Status:
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="demo">Demo</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label>
            Source:
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {state === "loading" && <p className="search-status">Loading evidence timeline…</p>}
        {state === "error" && <p className="search-error">{error}</p>}

        {state === "success" && items.length === 0 && (
          <p className="search-empty">No evidence found with the selected filters.</p>
        )}

        {state === "success" && items.length > 0 && (
          <div className="ev-timeline">
            {items.map((item) => (
              <div key={item.evidence.id} className="ev-timeline-item">
                <div className={`ev-timeline-dot ${item.evidence.status}`} />
                <div className="ev-timeline-date">{formatDate(item.evidence.observedAt)}</div>
                <div className="ev-timeline-content">
                  <div className="ev-timeline-source">{item.evidence.source.name}</div>
                  <div className="ev-timeline-note">{item.evidence.note}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="evidence-status">{item.evidence.status}</span>
                    {item.evidence.chain && (
                      <span className="category-badge">{item.evidence.chain}</span>
                    )}
                    {item.projectIds.map((pid) => (
                      <Link
                        key={pid}
                        href={`/projects/${pid}`}
                        className="ghost-button"
                        style={{ fontSize: 13, padding: "2px 8px" }}
                      >
                        → {pid}
                      </Link>
                    ))}
                    {item.narrativeIds.map((nid) => (
                      <Link
                        key={nid}
                        href={`/narratives/${nid}`}
                        className="ghost-button"
                        style={{ fontSize: 13, padding: "2px 8px" }}
                      >
                        → {nid}
                      </Link>
                    ))}
                  </div>
                  {item.evidence.reference && (
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      <a
                        href={item.evidence.reference}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ref-link"
                      >
                        {item.evidence.reference}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
