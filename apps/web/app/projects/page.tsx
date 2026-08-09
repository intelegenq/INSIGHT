import Link from "next/link";
import type { Project } from "@insight/core";

async function fetchProjects(): Promise<Project[]> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/projects`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { projects: Project[] };
  return data.projects;
}

export default async function ProjectsPage() {
  const projects = await fetchProjects();

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

      <section className="hero">
        <p className="eyebrow">PROJECT INTELLIGENCE</p>
        <h1>
          Protocols, projects,
          <br />
          <em>and their traction.</em>
        </h1>
        <p className="hero-copy">
          Structured views of each protocol&apos;s metrics, context, risks, and evidence. Click a
          project to explore its full intelligence page.
        </p>
      </section>

      <section className="section" aria-labelledby="projects-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BROWSE</p>
            <h2 id="projects-title">Tracked projects</h2>
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
