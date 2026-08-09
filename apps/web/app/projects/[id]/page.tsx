import Link from "next/link";
import { notFound } from "next/navigation";
import type { Project, Evidence } from "@insight/core";

interface ProjectHealth {
  health: number;
  momentum: number;
  risk: number;
  developer: number;
}

async function fetchProject(
  id: string,
): Promise<{ project: Project; evidence: Evidence[]; health?: ProjectHealth } | null> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/projects/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as { project: Project; evidence: Evidence[]; health?: ProjectHealth };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchProject(id);
  if (data === null) notFound();

  const { project, evidence, health } = data;

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <div className="nav-links">
          <Link href="/#pulse">Pulse</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/graph">Graph</Link>
          <Link href="/health">Health</Link>
          <Link href="/history">History</Link>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
        <Link className="ghost-button" href="/reports">
          Research mode <span>↗</span>
        </Link>
      </nav>

      <section className="hero project-hero">
        <p className="eyebrow">{project.category.toUpperCase()} · PROJECT INTELLIGENCE</p>
        <h1>{project.name}</h1>
        <p className="hero-copy">{project.description}</p>
      </section>

      <section className="section" aria-labelledby="metrics-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRACTION</p>
            <h2 id="metrics-title">Project metrics</h2>
          </div>
        </div>
        <div className="metric-grid">
          {project.metrics.tvl !== undefined && (
            <article className="metric-card" key="tvl">
              <span>TVL</span>
              <strong>${project.metrics.tvl.toLocaleString()}</strong>
              <small>Total value locked</small>
            </article>
          )}
          {project.metrics.volume24h !== undefined && (
            <article className="metric-card" key="volume">
              <span>24h Volume</span>
              <strong>${project.metrics.volume24h.toLocaleString()}</strong>
              <small>Trading volume (24h)</small>
            </article>
          )}
          {project.metrics.activeUsers24h !== undefined && (
            <article className="metric-card" key="users">
              <span>Active Users</span>
              <strong>{project.metrics.activeUsers24h.toLocaleString()}</strong>
              <small>Active users (24h)</small>
            </article>
          )}
          {project.metrics.developerActivity !== undefined && (
            <article className="metric-card" key="dev">
              <span>Dev Activity</span>
              <strong>{project.metrics.developerActivity}</strong>
              <small>Developer activity score</small>
            </article>
          )}
        </div>
      </section>

      {health !== undefined && (
        <section className="section" aria-labelledby="health-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HEALTH PROFILE</p>
              <h2 id="health-title">Risk &amp; momentum scores</h2>
            </div>
          </div>
          <div className="metric-grid">
            <article className="metric-card" key="health-score">
              <span>Health</span>
              <strong>{health.health.toFixed(1)}</strong>
              <small>Overall project health (0–100)</small>
            </article>
            <article className="metric-card violet" key="momentum">
              <span>Momentum</span>
              <strong>
                {health.momentum > 0 ? "+" : ""}
                {health.momentum.toFixed(1)}
              </strong>
              <small>Directional momentum (−100 to +100)</small>
            </article>
            <article className="metric-card" key="risk">
              <span>Risk</span>
              <strong>{health.risk.toFixed(1)}</strong>
              <small>Elevated risk factors (0–100)</small>
            </article>
            <article className="metric-card" key="developer">
              <span>Dev Activity</span>
              <strong>{health.developer.toFixed(1)}</strong>
              <small>Developer velocity score (0–100)</small>
            </article>
          </div>
        </section>
      )}

      {evidence.length > 0 && (
        <section className="section" aria-labelledby="evidence-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">EVIDENCE LOG</p>
              <h2 id="evidence-title">Sources backing this view</h2>
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
