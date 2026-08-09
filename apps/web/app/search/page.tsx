"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";

interface SearchProject {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface SearchNarrative {
  id: string;
  name: string;
  trend: string;
  note: string;
}

interface SearchEvidence {
  id: string;
  sourceName: string;
  note: string;
  status: string;
}

interface SearchResults {
  query: string;
  projects: SearchProject[];
  narratives: SearchNarrative[];
  evidence: SearchEvidence[];
  total: number;
}

type LoadState = "idle" | "loading" | "success" | "error";

function trendLabel(trend: string): string {
  switch (trend) {
    case "up":
      return "↑ Up";
    case "down":
      return "↓ Down";
    case "flat":
      return "→ Flat";
    case "watch":
      return "⊙ Watch";
    default:
      return trend;
  }
}

function trendClass(trend: string): string {
  switch (trend) {
    case "up":
      return "trend-up";
    case "down":
      return "trend-down";
    case "flat":
      return "trend-flat";
    case "watch":
      return "trend-watch";
    default:
      return "trend-flat";
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  const executeSearch = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults(null);
      setState("idle");
      return;
    }
    setState("loading");
    setError("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SearchResults;
      setResults(data);
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }, []);

  // Read query param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && q.length > 0) {
      setQuery(q);
      void executeSearch(q);
    }
  }, [executeSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeSearch(query);
  };

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
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/trends">Trends</Link>
        </div>
        <Link className="ghost-button" href="/reports">
          Research mode <span>↗</span>
        </Link>
      </nav>

      <section className="hero search-hero">
        <p className="eyebrow">SEARCH</p>
        <h1>
          Find anything across
          <br />
          <em>the ecosystem.</em>
        </h1>
        <p className="hero-copy">
          Search across all tracked projects, narratives, and evidence. Results are matched
          deterministically from Insight&apos;s live data — no external search service.
        </p>
        <form className="search-form" onSubmit={handleSubmit} role="search">
          <input
            type="search"
            className="search-input"
            placeholder="Search projects, narratives, evidence…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search query"
            autoFocus
          />
          <button type="submit" className="primary-button search-submit">
            Search <span>→</span>
          </button>
        </form>
      </section>

      {state === "loading" && (
        <section className="section">
          <p className="search-status">Searching…</p>
        </section>
      )}

      {state === "error" && (
        <section className="section">
          <p className="search-error">{error}</p>
        </section>
      )}

      {state === "success" && results && (
        <section className="section" aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RESULTS</p>
              <h2 id="results-title">
                {results.total > 0
                  ? `${results.total} match${results.total === 1 ? "" : "s"} for "${results.query}"`
                  : `No matches for "${results.query}"`}
              </h2>
            </div>
          </div>

          {results.projects.length > 0 && (
            <div className="search-group">
              <h3 className="search-group-title">Projects ({results.projects.length})</h3>
              <div className="project-grid">
                {results.projects.map((p) => (
                  <Link href={`/projects/${p.id}`} key={p.id} className="project-card-link">
                    <article className="project-card">
                      <div className="project-card-header">
                        <h3>{p.name}</h3>
                        <span className="category-badge">{p.category}</span>
                      </div>
                      <p className="project-description">{p.description}</p>
                      <span className="arrow">→</span>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.narratives.length > 0 && (
            <div className="search-group">
              <h3 className="search-group-title">Narratives ({results.narratives.length})</h3>
              <div className="narrative-list">
                {results.narratives.map((n) => (
                  <Link href={`/narratives/${n.id}`} key={n.id} className="narrative-card-link">
                    <article className="narrative-card">
                      <div className="narrative-card-header">
                        <h4>{n.name}</h4>
                        <span className={`trend-badge ${trendClass(n.trend)}`}>
                          {trendLabel(n.trend)}
                        </span>
                      </div>
                      <p className="narrative-note">{n.note}</p>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.evidence.length > 0 && (
            <div className="search-group">
              <h3 className="search-group-title">Evidence ({results.evidence.length})</h3>
              <div className="evidence-list">
                {results.evidence.map((e) => (
                  <article className="evidence-item" key={e.id}>
                    <div>
                      <h3>{e.sourceName}</h3>
                      <p>{e.note}</p>
                    </div>
                    <span className="evidence-status">{e.status}</span>
                  </article>
                ))}
              </div>
            </div>
          )}

          {results.total === 0 && (
            <p className="search-empty">Try a different keyword, project name, or source name.</p>
          )}
        </section>
      )}

      {state === "idle" && (
        <section className="section" aria-labelledby="search-tips-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TIPS</p>
              <h2 id="search-tips-title">What you can search</h2>
            </div>
          </div>
          <div className="metric-grid">
            <article className="metric-card">
              <span>Projects</span>
              <strong style={{ fontSize: "24px" }}>Name, category, description</strong>
              <small>Find protocols by name or category like &ldquo;defi&rdquo;</small>
            </article>
            <article className="metric-card violet">
              <span>Narratives</span>
              <strong style={{ fontSize: "24px" }}>Name, trend note</strong>
              <small>Discover themes like &ldquo;liquid staking&rdquo;</small>
            </article>
            <article className="metric-card">
              <span>Evidence</span>
              <strong style={{ fontSize: "24px" }}>Source name, note</strong>
              <small>Locate evidence by source like &ldquo;Helius&rdquo;</small>
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
