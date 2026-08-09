import Link from "next/link";
import { notFound } from "next/navigation";
import { projectRepository } from "@insight/data";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectRepository.getProject(id);
  if (project === undefined) notFound();

  const evidence = projectRepository.resolveEvidenceIds(project.evidenceIds);

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
