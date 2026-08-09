"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import type { PulseMetric, TimelineEvent } from "@insight/data";
import type { Narrative } from "@insight/core";

interface DashboardProject {
  id: string;
  name: string;
  category: string;
  description: string;
  tvl?: number;
  volume24h?: number;
}

interface DashboardData {
  pulse: { asOf: string; metrics: PulseMetric[] };
  timeline: TimelineEvent[];
  projects: DashboardProject[];
  narratives: Narrative[];
  asOf: string;
}

type SectionId = "pulse" | "projects" | "narratives" | "timeline";

interface SectionConfig {
  id: SectionId;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: "pulse", label: "Ecosystem Pulse", visible: true, order: 0 },
  { id: "projects", label: "Top Projects", visible: true, order: 1 },
  { id: "narratives", label: "Narratives", visible: true, order: 2 },
  { id: "timeline", label: "Research Timeline", visible: true, order: 3 },
];

const STORAGE_KEY = "insight-dashboard-config";

function loadConfig(): SectionConfig[] {
  if (typeof window === "undefined") return DEFAULT_SECTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SECTIONS;
    const parsed = JSON.parse(raw) as Partial<SectionConfig>[];
    if (!Array.isArray(parsed)) return DEFAULT_SECTIONS;
    // Merge with defaults to ensure all sections present
    return DEFAULT_SECTIONS.map((def) => {
      const saved = parsed.find((p) => p?.id === def.id);
      if (!saved) return def;
      return {
        id: def.id,
        label: def.label,
        visible: saved.visible ?? def.visible,
        order: saved.order ?? def.order,
      };
    });
  } catch {
    return DEFAULT_SECTIONS;
  }
}

function saveConfig(sections: SectionConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch {
    // ignore
  }
}

function trendTone(trend: string): string {
  return trend === "up" ? "positive" : "neutral";
}

function formatTvl(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

type LoadState = "idle" | "loading" | "success" | "error";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
  const [showSettings, setShowSettings] = useState(false);

  // Load config and data on mount
  useEffect(() => {
    setSections(loadConfig());
    async function loadData() {
      setState("loading");
      setError("");
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DashboardData;
        setData(json);
        setState("success");
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    }
    void loadData();
  }, []);

  const updateConfig = useCallback((next: SectionConfig[]) => {
    setSections(next);
    saveConfig(next);
  }, []);

  const toggleSection = (id: SectionId) => {
    updateConfig(sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };

  const moveSection = (id: SectionId, dir: -1 | 1) => {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const current = sorted[idx]!;
    const target = sorted[swapIdx]!;
    const newOrder = current.order;
    current.order = target.order;
    target.order = newOrder;
    updateConfig([...sorted]);
  };

  const resetConfig = () => {
    updateConfig(DEFAULT_SECTIONS.map((s) => ({ ...s })));
  };

  const sortedVisible = [...sections].filter((s) => s.visible).sort((a, b) => a.order - b.order);

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
        <button className="ghost-button" onClick={() => setShowSettings(!showSettings)}>
          Customize <span>⚙</span>
        </button>
      </nav>

      <section className="hero dashboard-hero">
        <p className="eyebrow">CUSTOMIZABLE DASHBOARD</p>
        <h1>
          Your view,
          <br />
          <em>your way.</em>
        </h1>
        <p className="hero-copy">
          Toggle, reorder, and customize which sections appear on your dashboard. Your preferences
          persist across sessions.
        </p>
        {data && (
          <p className="as-of" style={{ marginTop: 16 }}>
            Last updated · {data.asOf}
          </p>
        )}
      </section>

      {showSettings && (
        <section className="section dashboard-settings" aria-labelledby="settings-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SETTINGS</p>
              <h2 id="settings-title">Dashboard layout</h2>
            </div>
            <button className="ghost-button" onClick={resetConfig}>
              Reset to default
            </button>
          </div>
          <div className="dashboard-settings-list">
            {[...sections]
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <div key={s.id} className="dashboard-setting-row">
                  <label className="dashboard-toggle-label">
                    <input
                      type="checkbox"
                      checked={s.visible}
                      onChange={() => toggleSection(s.id)}
                    />
                    <span>{s.label}</span>
                  </label>
                  <div className="dashboard-reorder">
                    <button
                      className="ghost-button dashboard-move-btn"
                      onClick={() => moveSection(s.id, -1)}
                      disabled={s.order === 0}
                      aria-label={`Move ${s.label} up`}
                    >
                      ↑
                    </button>
                    <button
                      className="ghost-button dashboard-move-btn"
                      onClick={() => moveSection(s.id, 1)}
                      disabled={s.order === sections.length - 1}
                      aria-label={`Move ${s.label} down`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {state === "loading" && (
        <section className="section">
          <p className="search-status">Loading dashboard…</p>
        </section>
      )}

      {state === "error" && (
        <section className="section">
          <p className="search-error">{error}</p>
        </section>
      )}

      {state === "success" && data && (
        <>
          {sortedVisible.map((section) => {
            if (section.id === "pulse") {
              return (
                <section key="pulse" className="section pulse" aria-labelledby="dash-pulse-title">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">ECOSYSTEM PULSE</p>
                      <h2 id="dash-pulse-title">A quieter way to read the day.</h2>
                    </div>
                    <p className="as-of">Snapshot · {data.pulse.asOf}</p>
                  </div>
                  <div className="metric-grid">
                    {data.pulse.metrics.map((metric) => (
                      <article
                        className={
                          metric.variant === "violet" ? "metric-card violet" : "metric-card"
                        }
                        key={metric.id}
                      >
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        <small>{metric.caption}</small>
                      </article>
                    ))}
                  </div>
                </section>
              );
            }

            if (section.id === "projects") {
              return (
                <section key="projects" className="section" aria-labelledby="dash-projects-title">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">TOP PROJECTS</p>
                      <h2 id="dash-projects-title">Protocols by TVL.</h2>
                    </div>
                    <Link className="ghost-button" href="/projects">
                      Browse all <span>→</span>
                    </Link>
                  </div>
                  <div className="project-grid">
                    {data.projects.map((p) => (
                      <Link href={`/projects/${p.id}`} key={p.id} className="project-card-link">
                        <article className="project-card">
                          <div className="project-card-header">
                            <h3>{p.name}</h3>
                            <span className="category-badge">{p.category}</span>
                          </div>
                          <p className="project-description">{p.description}</p>
                          {p.tvl !== undefined && (
                            <p className="project-metric">TVL: {formatTvl(p.tvl)}</p>
                          )}
                          <span className="arrow">→</span>
                        </article>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            }

            if (section.id === "narratives") {
              return (
                <section
                  key="narratives"
                  className="section two-column"
                  aria-labelledby="dash-narratives-title"
                >
                  <div>
                    <p className="eyebrow">NARRATIVES</p>
                    <h2 id="dash-narratives-title">What deserves a closer look.</h2>
                    <p className="section-copy">
                      Narratives combine signals into research starting points — not trading
                      recommendations.
                    </p>
                  </div>
                  <div className="narrative-list">
                    {data.narratives.map((n) => (
                      <Link href={`/narratives/${n.id}`} key={n.id} className="narrative-card-link">
                        <article className="narrative-card">
                          <div className="narrative-card-header">
                            <h4>{n.name}</h4>
                            <span className={trendTone(n.trend)}>{n.change}</span>
                          </div>
                          <p className="narrative-note">{n.note}</p>
                        </article>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            }

            if (section.id === "timeline") {
              return (
                <section
                  key="timeline"
                  className="section timeline"
                  aria-labelledby="dash-timeline-title"
                >
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">RESEARCH TIMELINE</p>
                      <h2 id="dash-timeline-title">Context, not just updates.</h2>
                    </div>
                    <Link className="ghost-button" href="/reports">
                      Generate a brief →
                    </Link>
                  </div>
                  <div className="event-list">
                    {data.timeline.map((event) => (
                      <article className="event" key={event.id}>
                        <time>{event.time}</time>
                        <div>
                          <h3>{event.title}</h3>
                          <p>
                            {event.source} <span>·</span> {event.confidence}
                          </p>
                        </div>
                        <span className="event-arrow">↗</span>
                      </article>
                    ))}
                  </div>
                </section>
              );
            }

            return null;
          })}
        </>
      )}

      {state === "idle" && (
        <section className="section">
          <p className="search-status">Loading dashboard…</p>
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
