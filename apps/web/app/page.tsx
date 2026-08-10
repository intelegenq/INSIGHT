import Link from "next/link";
import { headers } from "next/headers";
import type { PulseMetric, TimelineEvent } from "@insight/data";
import type { Narrative, Project } from "@insight/core";

async function getBaseUrl(): Promise<string> {
  const explicit = process.env["NEXT_PUBLIC_BASE_URL"];
  if (explicit) return explicit;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [] as unknown as T;
  return (await res.json()) as T;
}

function fmtNum(v: number | undefined): string {
  if (v === undefined || v === null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function fmtTvl(v: number | undefined): string {
  if (v === undefined || v === null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

export default async function Home() {
  const baseUrl = await getBaseUrl();
  const [pulseData, projectsData, narrativesData] = await Promise.all([
    fetchJson<{ pulse: { asOf: string; metrics: PulseMetric[] }; timeline: TimelineEvent[] }>(
      `${baseUrl}/api/pulse`,
    ).catch(() => ({ pulse: { asOf: "", metrics: [] }, timeline: [] })),
    fetchJson<{ projects: Project[] }>(`${baseUrl}/api/projects`).catch(() => ({ projects: [] })),
    fetchJson<{ narratives: Narrative[] }>(`${baseUrl}/api/narratives`).catch(() => ({
      narratives: [],
    })),
  ]);

  const { pulse, timeline } = pulseData;
  const projects = (projectsData as { projects?: Project[] }).projects ?? [];
  const narratives = (narrativesData as { narratives?: Narrative[] }).narratives ?? [];

  // Calculate ecosystem stats
  const totalTvl = projects.reduce((sum, p) => sum + (p.metrics?.tvl ?? 0), 0);
  const totalVolume = projects.reduce((sum, p) => sum + (p.metrics?.volume24h ?? 0), 0);
  const topProjects = [...projects]
    .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
    .slice(0, 8);
  const categories = new Set(projects.map((p) => p.category));

  // Get metric values
  const getMetric = (id: string) => pulse.metrics.find((m) => m.id === id)?.value ?? "—";

  return (
    <div>
      {/* Hero header */}
      <div className="page-hero">
        <p className="eyebrow">SOLANA INTELLIGENCE TERMINAL</p>
        <h1>
          Everything happening across Solana, <em>in one terminal.</em>
        </h1>
        <p className="hero-copy">
          Real-time data from Solana RPC, DeFiLlama, CoinGecko, and Helius — with evidence
          traceability, anomaly detection, and grounded AI analysis.
        </p>
      </div>

      <div className="terminal-main">
        {/* Market + Network + DeFi Snapshot */}
        <div className="terminal-section">
          <div className="section-header">
            <div>
              <div className="section-title">Ecosystem Snapshot</div>
              <div className="section-subtitle">
                Live data · {pulse.asOf ? new Date(pulse.asOf).toLocaleString() : "loading"}
              </div>
            </div>
          </div>
          <div className="terminal-grid terminal-grid-4">
            <div className="metric-card">
              <span className="metric-label">Tracked Projects</span>
              <span className="metric-value">{getMetric("projects")}</span>
              <span className="metric-sub">{categories.size} categories indexed</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Total TVL</span>
              <span className="metric-value">{fmtTvl(totalTvl)}</span>
              <span className="metric-sub">Across {projects.length} protocols</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">24h Volume</span>
              <span className="metric-value">{fmtTvl(totalVolume)}</span>
              <span className="metric-sub">DEX + protocol volume</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Evidence Items</span>
              <span className="metric-value">{getMetric("evidence")}</span>
              <span className="metric-sub">Source-backed signals</span>
            </div>
          </div>
        </div>

        {/* Solana Now Feed */}
        <div className="terminal-section">
          <div className="section-header">
            <div>
              <div className="section-title">Solana Now</div>
              <div className="section-subtitle">Real-time intelligence feed</div>
            </div>
            <Link href="/solana-now" className="t-card-link">
              View all →
            </Link>
          </div>
          <div className="solana-now">
            {timeline.slice(0, 6).map((t, i) => (
              <div key={t.id} className="feed-item">
                <span className={`feed-badge ${i === 0 ? "breaking" : i === 1 ? "new" : "event"}`}>
                  {i === 0 ? "BREAKING" : i === 1 ? "NEW" : "EVENT"}
                </span>
                <div className="feed-content">
                  <div className="feed-headline">{t.title}</div>
                  <div className="feed-meta">
                    <span className="feed-source">{t.source}</span>
                    <span>·</span>
                    <span>{t.confidence}</span>
                  </div>
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div className="t-empty">
                No real-time updates yet. Trigger a refresh to populate the feed.
              </div>
            )}
          </div>
        </div>

        {/* Top Projects + Narratives */}
        <div className="terminal-grid terminal-grid-2">
          {/* Top Projects */}
          <div className="terminal-section">
            <div className="section-header">
              <div className="section-title">Top Protocols by TVL</div>
              <Link href="/ecosystem" className="t-card-link">
                All →
              </Link>
            </div>
            <div className="t-card" style={{ padding: 0 }}>
              <table className="t-table">
                <thead>
                  <tr>
                    <th>Protocol</th>
                    <th className="right">TVL</th>
                    <th className="right">24h Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {topProjects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/projects/${p.id}`} className="ref-link">
                          {p.name}
                        </Link>
                        <span className="category-badge" style={{ marginLeft: 8 }}>
                          {p.category}
                        </span>
                      </td>
                      <td className="right mono">{fmtTvl(p.metrics?.tvl)}</td>
                      <td className="right mono">{fmtNum(p.metrics?.volume24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Narratives */}
          <div className="terminal-section">
            <div className="section-header">
              <div className="section-title">Active Narratives</div>
              <Link href="/ecosystem" className="t-card-link">
                All →
              </Link>
            </div>
            <div className="t-card">
              {narratives.map((n) => (
                <Link
                  href={`/narratives/${n.id}`}
                  key={n.id}
                  className="narrative-card-link"
                  style={{ marginBottom: 8, display: "block" }}
                >
                  <div className="narrative-card-header">
                    <h4>{n.name}</h4>
                    <span className={`trend-badge trend-${n.trend}`}>{n.trend}</span>
                  </div>
                  <p className="narrative-note">{n.note}</p>
                  {n.change && <span className="narrative-change">{n.change}</span>}
                </Link>
              ))}
              {narratives.length === 0 && <div className="t-empty">No narratives detected.</div>}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="terminal-section">
          <div className="terminal-grid terminal-grid-4">
            <Link href="/analytics" className="t-card" style={{ textDecoration: "none" }}>
              <div className="t-card-title">Analytics</div>
              <div style={{ fontSize: 14, marginTop: 8, color: "var(--text)" }}>
                Deep metrics, charts, rankings →
              </div>
            </Link>
            <Link href="/research" className="t-card" style={{ textDecoration: "none" }}>
              <div className="t-card-title">Research</div>
              <div style={{ fontSize: 14, marginTop: 8, color: "var(--text)" }}>
                Reports, evidence, history →
              </div>
            </Link>
            <Link href="/assistant" className="t-card" style={{ textDecoration: "none" }}>
              <div className="t-card-title">Ask Insight</div>
              <div style={{ fontSize: 14, marginTop: 8, color: "var(--text)" }}>
                Grounded AI analysis →
              </div>
            </Link>
            <Link href="/alerts" className="t-card" style={{ textDecoration: "none" }}>
              <div className="t-card-title">Alerts</div>
              <div style={{ fontSize: 14, marginTop: 8, color: "var(--text)" }}>
                Anomaly subscriptions →
              </div>
            </Link>
          </div>
        </div>
      </div>

      <footer>
        <div>
          <div className="brand">◎ Insight</div>
          <div>Solana Intelligence Terminal · Evidence-backed</div>
        </div>
        <div>© 2026 · Built for the Solana ecosystem reporting Mission</div>
      </footer>
    </div>
  );
}
