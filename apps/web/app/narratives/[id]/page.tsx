import Link from "next/link";
import { notFound } from "next/navigation";
import type { Narrative, NarrativeTrend, Project, Evidence } from "@insight/core";

function trendLabel(trend: NarrativeTrend): string {
  switch (trend) {
    case "up":
      return "↑ Up";
    case "down":
      return "↓ Down";
    case "flat":
      return "→ Flat";
    case "watch":
      return "⊙ Watch";
  }
}

function trendClass(trend: NarrativeTrend): string {
  switch (trend) {
    case "up":
      return "trend-up";
    case "down":
      return "trend-down";
    case "flat":
      return "trend-flat";
    case "watch":
      return "trend-watch";
  }
}

async function fetchNarrative(
  id: string,
): Promise<{ narrative: Narrative; projects: Project[]; evidence: Evidence[] } | null> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/narratives/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as {
    narrative: Narrative;
    projects: Project[];
    evidence: Evidence[];
  };
}

export default async function NarrativeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchNarrative(id);
  if (data === null) notFound();

  const { narrative, projects, evidence } = data;

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
      </nav>

      <section className="hero narratives-hero">
        <p className="eyebrow">NARRATIVE</p>
        <h1>{narrative.name}</h1>
        <div className="narrative-card-header" style={{ marginTop: 16 }}>
          <span className={`trend-badge ${trendClass(narrative.trend)}`}>
            {trendLabel(narrative.trend)}
          </span>
          {narrative.change && <span className="narrative-change">{narrative.change}</span>}
        </div>
        <p className="hero-copy">{narrative.note}</p>
      </section>

      {projects.length > 0 && (
        <section className="section" aria-labelledby="projects-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">REPRESENTATIVE PROJECTS</p>
              <h2 id="projects-title">Linked projects ({projects.length})</h2>
            </div>
          </div>
          <div className="project-grid">
            {projects.map((p) => (
              <Link href={`/projects/${p.id}`} key={p.id} className="project-card-link">
                <article className="project-card">
                  <div className="project-card-header">
                    <h3>{p.name}</h3>
                    <span className="category-badge">{p.category}</span>
                  </div>
                  <p className="project-description">{p.description}</p>
                  {p.metrics.tvl !== undefined && (
                    <p className="project-metric">TVL: ${p.metrics.tvl.toLocaleString()}</p>
                  )}
                  <span className="arrow">→</span>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}

      {evidence.length > 0 && (
        <section className="section" aria-labelledby="evidence-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">EVIDENCE LOG</p>
              <h2 id="evidence-title">Supporting evidence ({evidence.length})</h2>
            </div>
          </div>
          <div className="evidence-list">
            {evidence.map((item) => (
              <article className="evidence-item" key={item.id}>
                <div>
                  <h3>{item.source.name}</h3>
                  <p>{item.note}</p>
                </div>
                <span className="evidence-status">{item.status}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && evidence.length === 0 && (
        <section className="section">
          <p className="muted">This narrative has no linked projects or evidence yet.</p>
        </section>
      )}

      <section className="section">
        <Link href="/narratives" className="ghost-button">
          ← Back to narratives
        </Link>
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
