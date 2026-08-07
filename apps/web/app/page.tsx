import { projectRepository } from "@insight/data";
import type { NarrativeTrend } from "@insight/core";

function trendTone(trend: NarrativeTrend): string {
  switch (trend) {
    case "up":
      return "positive";
    default:
      return "neutral";
  }
}

export default function Home() {
  const pulse = projectRepository.getPulse();
  const timelines = projectRepository.getTimeline();
  const narratives = projectRepository.getNarratives();

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Insight home">
          <span>◎</span> insight
        </a>
        <div className="nav-links">
          <a href="#pulse">Pulse</a>
          <a href="#narratives">Narratives</a>
          <a href="/reports">Reports</a>
        </div>
        <a className="ghost-button" href="/reports">
          Research mode <span>↗</span>
        </a>
      </nav>

      <section className="hero" id="top">
        <p className="eyebrow">SOLANA INTELLIGENCE / DEMO</p>
        <h1>
          See the signal.
          <br />
          <em>Understand the story.</em>
        </h1>
        <p className="hero-copy">
          Insight turns ecosystem activity into calm, evidence-aware research. This initial view
          uses clearly labeled illustrative data while live collectors are being built.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="#pulse">
            Explore today&apos;s pulse <span>↓</span>
          </a>
          <a className="text-link" href="/reports">
            View sample brief →
          </a>
        </div>
      </section>

      <section className="section pulse" id="pulse" aria-labelledby="pulse-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ECOSYSTEM PULSE</p>
            <h2 id="pulse-title">A quieter way to read the day.</h2>
          </div>
          <p className="as-of">
            Demo snapshot · {pulse.asOf}
            <br />
            Not live market data
          </p>
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

      <section className="section two-column" id="narratives" aria-labelledby="narratives-title">
        <div>
          <p className="eyebrow">NARRATIVES</p>
          <h2 id="narratives-title">What deserves a closer look.</h2>
          <p className="section-copy">
            Narratives combine signals into research starting points—not trading recommendations.
            Each future result will expose its evidence and time range.
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
          <a className="ghost-button" href="/reports">
            Generate a brief →
          </a>
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
          <p className="eyebrow">REPORT ENGINE / DEMO</p>
          <h2>From scattered signals to a defensible brief.</h2>
          <p>
            Preview a structured research memo with an executive summary, evidence log, catalysts,
            risks, and an explicit confidence level.
          </p>
        </div>
        <a className="primary-button light" href="/reports">
          Open report studio <span>→</span>
        </a>
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
