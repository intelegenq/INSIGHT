import Link from "next/link";
import type { PulseMetric, TimelineEvent } from "@insight/data";
import type { Narrative } from "@insight/core";

function trendTone(trend: string): string {
  switch (trend) {
    case "up":
      return "positive";
    default:
      return "neutral";
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return (await res.json()) as T;
}

export default async function Home() {
  // Fetch all data through API routes — no direct projectRepository import
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  const [pulseData, projectsData, narrativesData] = await Promise.all([
    fetchJson<{ pulse: { asOf: string; metrics: PulseMetric[] }; timeline: TimelineEvent[] }>(
      `${baseUrl}/api/pulse`,
    ),
    fetchJson<{
      projects: {
        id: string;
        name: string;
        category: string;
        description: string;
        metrics: { tvl?: number };
      }[];
    }>(`${baseUrl}/api/projects`),
    fetchJson<{ narratives: Narrative[] }>(`${baseUrl}/api/narratives`),
  ]);

  const { pulse, timeline: timelines } = pulseData;
  const narratives = narrativesData.narratives;

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Insight home">
          <span>◎</span> insight
        </a>
        <div className="nav-links">
          <a href="#pulse">Pulse</a>
          <Link href="/projects">Projects</Link>
          <a href="#narratives">Narratives</a>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/history">History</Link>
        </div>
        <Link className="ghost-button" href="/reports">
          Research mode <span>↗</span>
        </Link>
      </nav>

      <section className="hero" id="top">
        <p className="eyebrow">SOLANA INTELLIGENCE</p>
        <h1>
          See the signal.
          <br />
          <em>Understand the story.</em>
        </h1>
        <p className="hero-copy">
          Insight turns ecosystem activity into calm, evidence-aware research.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="#pulse">
            Explore today&apos;s pulse <span>↓</span>
          </a>
          <Link className="text-link" href="/reports">
            View sample brief →
          </Link>
        </div>
      </section>

      <section className="section pulse" id="pulse" aria-labelledby="pulse-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ECOSYSTEM PULSE</p>
            <h2 id="pulse-title">A quieter way to read the day.</h2>
          </div>
          <p className="as-of">Snapshot · {pulse.asOf}</p>
        </div>
        <div className="metric-grid">
          {pulse.metrics.map((metric) => (
            <article
              className={metric.variant === "violet" ? "metric-card violet" : "metric-card"}
              key={metric.id}
            >
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.caption}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="projects-section-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PROJECT INTELLIGENCE</p>
            <h2 id="projects-section-title">Explore tracked protocols.</h2>
          </div>
          <Link className="ghost-button" href="/projects">
            Browse all projects <span>→</span>
          </Link>
        </div>
      </section>

      <section className="section two-column" id="narratives" aria-labelledby="narratives-title">
        <div>
          <p className="eyebrow">NARRATIVES</p>
          <h2 id="narratives-title">What deserves a closer look.</h2>
          <p className="section-copy">
            Narratives combine signals into research starting points—not trading recommendations.
            Each result exposes its evidence and time range.
          </p>
        </div>
        <div className="narrative-list">
          {narratives.map((n) => (
            <article className="narrative" key={n.id}>
              <div>
                <div className="narrative-top">
                  <h3>{n.name}</h3>
                  <span className={trendTone(n.trend)}>{n.change}</span>
                </div>
                <p>{n.note}</p>
              </div>
              <span className="arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section timeline" aria-labelledby="timeline-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RESEARCH TIMELINE</p>
            <h2 id="timeline-title">Context, not just updates.</h2>
          </div>
          <Link className="ghost-button" href="/reports">
            Generate a brief →
          </Link>
        </div>
        <div className="event-list">
          {timelines.map((event) => (
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

      <section className="report-callout" id="reports">
        <div>
          <p className="eyebrow">REPORT ENGINE</p>
          <h2>From scattered signals to a defensible brief.</h2>
          <p>
            Preview a structured research memo with an executive summary, evidence log, catalysts,
            risks, and an explicit confidence level.
          </p>
        </div>
        <Link className="primary-button light" href="/reports">
          Open report studio <span>→</span>
        </Link>
      </section>

      <footer>
        <a className="brand" href="#top">
          <span>◎</span> insight
        </a>
        <p>Built for better questions about Solana.</p>
        <p>© 2026 Insight</p>
      </footer>
    </main>
  );
}
