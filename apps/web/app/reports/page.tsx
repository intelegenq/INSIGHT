"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const evidence = [
  {
    source: "Protocol telemetry",
    note: "Illustrative TVL and lending-activity signal",
    status: "Demo",
  },
  {
    source: "Developer activity",
    note: "Illustrative release and repository signal",
    status: "Demo",
  },
  {
    source: "Ecosystem monitoring",
    note: "Illustrative narrative and launch signal",
    status: "Demo",
  },
];

const lenses = {
  ecosystem: {
    title: "Solana ecosystem pulse",
    thesis:
      "Liquidity and consumer activity are the strongest illustrative signals in this demo snapshot.",
    catalyst:
      "Protocol launches and lending demand could reinforce attention around the ecosystem.",
    risk: "These signals are illustrative; live collection and source validation are not active yet.",
  },
  defi: {
    title: "Solana DeFi brief",
    thesis:
      "The demo points to a constructive liquidity backdrop, led by lending and capital efficiency.",
    catalyst: "Higher utilization and new collateral routes would be the next signals to validate.",
    risk: "TVL and volume movements need source-backed context before they support a conclusion.",
  },
  infrastructure: {
    title: "Solana infrastructure brief",
    thesis: "Developer activity suggests continued attention on performance and data tooling.",
    catalyst:
      "Shipping milestones and adoption by consumer applications would strengthen the case.",
    risk: "Repository activity alone is not a reliable proxy for real adoption.",
  },
};

export default function ReportsPage() {
  const [lens, setLens] = useState<keyof typeof lenses>("ecosystem");
  const [isEvidenceOpen, setEvidenceOpen] = useState(true);
  const report = useMemo(() => lenses[lens], [lens]);

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <div className="nav-links">
          <Link href="/#pulse">Pulse</Link>
          <Link href="/#narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
        </div>
        <span className="demo-chip">Demo mode</span>
      </nav>

      <section className="report-hero">
        <div>
          <p className="eyebrow">REPORT ENGINE / DEMO</p>
          <h1>
            Build a brief.
            <br />
            <em>Keep the evidence.</em>
          </h1>
          <p className="hero-copy">
            Choose a research lens to preview how Insight will present a concise, inspectable memo.
            No external API or live data is used here.
          </p>
        </div>
        <aside className="report-controls" aria-label="Report controls">
          <span className="control-label">Research lens</span>
          <div className="lens-options">
            {(Object.keys(lenses) as Array<keyof typeof lenses>).map((option) => (
              <button
                className={lens === option ? "lens active" : "lens"}
                key={option}
                onClick={() => setLens(option)}
              >
                {option === "ecosystem"
                  ? "Ecosystem"
                  : option === "defi"
                    ? "DeFi"
                    : "Infrastructure"}
              </button>
            ))}
          </div>
          <p>
            This changes the demo memo only. A future version will retain cited source snapshots.
          </p>
        </aside>
      </section>

      <section className="report-workspace" aria-label="Generated report preview">
        <article className="memo">
          <div className="memo-meta">
            <span>INSIGHT RESEARCH MEMO</span>
            <span>07 AUG 2026 · DEMO</span>
          </div>
          <h2>{report.title}</h2>
          <div className="memo-grid">
            <div>
              <p className="memo-label">Executive summary</p>
              <p>{report.thesis}</p>
            </div>
            <div>
              <p className="memo-label">What could matter next</p>
              <p>{report.catalyst}</p>
            </div>
            <div>
              <p className="memo-label">Research caveat</p>
              <p>{report.risk}</p>
            </div>
          </div>
          <div className="memo-footer">
            <span>Confidence</span>
            <strong>Illustrative</strong>
            <span>Not investment advice</span>
          </div>
        </article>

        <aside className="evidence-panel">
          <button
            className="evidence-toggle"
            onClick={() => setEvidenceOpen(!isEvidenceOpen)}
            aria-expanded={isEvidenceOpen}
          >
            <span>
              <span className="eyebrow">EVIDENCE LOG</span>
              <strong>Why this memo says what it says</strong>
            </span>
            <span>{isEvidenceOpen ? "−" : "+"}</span>
          </button>
          {isEvidenceOpen && (
            <div className="evidence-list">
              {evidence.map((item) => (
                <article key={item.source}>
                  <div>
                    <h3>{item.source}</h3>
                    <p>{item.note}</p>
                  </div>
                  <span>{item.status}</span>
                </article>
              ))}
            </div>
          )}
        </aside>
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
