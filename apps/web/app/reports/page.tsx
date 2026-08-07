"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReportLens } from "@insight/core";
import { projectRepository } from "@insight/data";

const lensLabels: Record<ReportLens, string> = {
  ecosystem: "Ecosystem",
  defi: "DeFi",
  infrastructure: "Infrastructure",
};

const lensOptions: ReportLens[] = ["ecosystem", "defi", "infrastructure"];

export default function ReportsPage() {
  const [lens, setLens] = useState<ReportLens>("ecosystem");
  const [isEvidenceOpen, setEvidenceOpen] = useState(true);

  const report = useMemo(() => projectRepository.getReport(lens), [lens]);
  const evidence = useMemo(
    () => (report ? projectRepository.resolveEvidenceIds(report.evidenceIds) : []),
    [report],
  );

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
            {lensOptions.map((option) => (
              <button
                className={lens === option ? "lens active" : "lens"}
                key={option}
                onClick={() => setLens(option)}
              >
                {lensLabels[option]}
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
          {report && (
            <>
              <h2>{report.title}</h2>
              <div className="memo-grid">
                <div>
                  <p className="memo-label">Executive summary</p>
                  <p>{report.sections.thesis}</p>
                </div>
                <div>
                  <p className="memo-label">What could matter next</p>
                  <p>{report.sections.catalyst}</p>
                </div>
                <div>
                  <p className="memo-label">Research caveat</p>
                  <p>{report.sections.risk}</p>
                </div>
              </div>
              <div className="memo-footer">
                <span>Confidence</span>
                <strong>{report.confidence}</strong>
                <span>Not investment advice</span>
              </div>
            </>
          )}
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
                <article key={item.id}>
                  <div>
                    <h3>{item.source.name}</h3>
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
