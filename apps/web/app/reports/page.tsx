"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { Report, ReportLens, Evidence } from "@insight/core";

const lensLabels: Record<ReportLens, string> = {
  ecosystem: "Ecosystem",
  defi: "DeFi",
  infrastructure: "Infrastructure",
};

const lensOptions: ReportLens[] = ["ecosystem", "defi", "infrastructure"];

const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "";

export default function ReportsPage() {
  const [lens, setLens] = useState<ReportLens>("ecosystem");
  const [isEvidenceOpen, setEvidenceOpen] = useState(true);
  const [report, setReport] = useState<Report | undefined>(undefined);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadReport() {
      try {
        const res = await fetch(`${baseUrl}/api/reports?lens=${lens}`);
        if (!res.ok) {
          setReport(undefined);
          setEvidence([]);
          return;
        }
        const data = (await res.json()) as { report: Report };
        if (cancelled) return;
        setReport(data.report);
        // Fetch evidence for the report
        const evidenceRes = await fetch(
          `${baseUrl}/api/evidence?ids=${data.report.evidenceIds.join(",")}`,
        );
        if (evidenceRes.ok) {
          const evidenceData = (await evidenceRes.json()) as { evidence: Evidence[] };
          if (!cancelled) setEvidence(evidenceData.evidence);
        } else {
          if (!cancelled) setEvidence([]);
        }
      } catch {
        if (!cancelled) {
          setReport(undefined);
          setEvidence([]);
        }
      }
    }
    loadReport();
    return () => {
      cancelled = true;
    };
  }, [lens]);

  const handleExport = useCallback(
    async (format: "markdown" | "json") => {
      setExporting(true);
      try {
        const res = await fetch(`${baseUrl}/api/reports/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lens, format }),
        });
        if (!res.ok) throw new Error(`Export failed: ${res.status}`);
        const data = (await res.json()) as { content: string; reportId: string };
        // Trigger download
        const blob = new Blob([data.content], {
          type: format === "json" ? "application/json" : "text/markdown",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `insight-report-${data.reportId}.${format === "json" ? "json" : "md"}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      } finally {
        setExporting(false);
      }
    },
    [lens],
  );

  const handleSave = useCallback(async () => {
    if (!report) return;
    setSaveError("");
    setSaved(false);
    try {
      const res = await fetch(`${baseUrl}/api/saved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "report",
          reportId: report.id,
          lens: report.lens,
          title: report.title,
        }),
      });
      if (res.status === 401) {
        setSaveError("Sign in to save research.");
        return;
      }
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
    } catch {
      setSaveError("Failed to save report.");
    }
  }, [report]);

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
          <Link href="/history">History</Link>
          <Link href="/saved">Saved</Link>
          <Link href="/search">Search</Link>
        </div>
      </nav>

      <section className="report-hero">
        <div>
          <p className="eyebrow">REPORT ENGINE</p>
          <h1>
            Build a brief.
            <br />
            <em>Keep the evidence.</em>
          </h1>
          <p className="hero-copy">
            Choose a research lens to preview how Insight presents a concise, inspectable memo.
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
        </aside>
      </section>

      <section className="report-workspace" aria-label="Generated report preview">
        <article className="memo">
          <div className="memo-meta">
            <span>INSIGHT RESEARCH MEMO</span>
            {report && <span>{new Date(report.generatedAt).toLocaleDateString()}</span>}
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
              <div className="report-actions">
                <button
                  className="ghost-button"
                  onClick={() => void handleExport("markdown")}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : "Export MD"}
                </button>
                <button
                  className="ghost-button"
                  onClick={() => void handleExport("json")}
                  disabled={exporting}
                >
                  Export JSON
                </button>
                <button
                  className="primary-button"
                  onClick={() => void handleSave()}
                  disabled={saved}
                >
                  {saved ? "✓ Saved" : "Save"}
                </button>
                {saveError && <span className="save-error">{saveError}</span>}
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
