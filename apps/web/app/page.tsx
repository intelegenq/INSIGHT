const narratives = [
  {
    name: "DeFi liquidity",
    change: "+18.4%",
    note: "Borrowing activity and TVL are expanding across the lending stack.",
    tone: "positive",
  },
  {
    name: "Consumer apps",
    change: "+7.2%",
    note: "New launches are bringing more recurring on-chain activity.",
    tone: "positive",
  },
  {
    name: "Infrastructure",
    change: "Watch",
    note: "Developer releases are concentrated around performance and data tooling.",
    tone: "neutral",
  },
];

const events = [
  {
    time: "09:40 UTC",
    title: "Liquidity momentum strengthens across leading protocols",
    source: "Demo signal",
    confidence: "Illustrative",
  },
  {
    time: "08:15 UTC",
    title: "Developer activity points to renewed infrastructure focus",
    source: "Demo signal",
    confidence: "Illustrative",
  },
  {
    time: "06:30 UTC",
    title: "Solana ecosystem pulse prepared for review",
    source: "Insight",
    confidence: "Draft",
  },
];

export default function Home() {
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
            Explore today’s pulse <span>↓</span>
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
            Demo snapshot · 07 Aug 2026
            <br />
            Not live market data
          </p>
        </div>
        <div className="metric-grid">
          <article className="metric-card">
            <span>Signals reviewed</span>
            <strong>24</strong>
            <small>Illustrative events across on-chain and off-chain sources</small>
          </article>
          <article className="metric-card">
            <span>Emerging narratives</span>
            <strong>03</strong>
            <small>Detected themes awaiting source-backed scoring</small>
          </article>
          <article className="metric-card violet">
            <span>Research confidence</span>
            <strong>—</strong>
            <small>Available once connected sources and evaluation rules are live</small>
          </article>
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
            <article className="narrative" key={n.name}>
              <div>
                <div className="narrative-top">
                  <h3>{n.name}</h3>
                  <span className={n.tone}>{n.change}</span>
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
          {events.map((event) => (
            <article className="event" key={event.time}>
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
