"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";

interface Report {
  id: string;
  title: string;
  lens: string;
  confidence: string;
  generatedAt: string;
  isDemo: boolean;
  sections: { thesis: string; catalyst?: string; risk?: string };
  evidenceIds: string[];
}

export default function ResearchPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Research] User is viewing research reports with export options (Markdown/JSON/PDF) and evidence citations.",
    );
  }, [setPageContext]);
  const [report, setReport] = useState<Report | undefined>();
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lens, setLens] = useState("ecosystem");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?lens=${lens}`);
      if (!res.ok) {
        setReport(undefined);
        return;
      }
      const data = (await res.json()) as { report: Report };
      setReport(data.report);
      setEvidenceCount(data.report.evidenceIds.length);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [lens]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportReport = async (format: string) => {
    setExporting(true);
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lens, format }),
      });
      if (res.ok) {
        const data = await res.json();
        if (format === "pdf") {
          const w = window.open("", "_blank");
          if (w) {
            w.document.write(data.content);
            w.document.close();
          }
        } else {
          const blob = new Blob([data.content], {
            type: format === "json" ? "application/json" : "text/markdown",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `insight-report-${lens}.${format}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch {
      /* ignore */
    }
    setExporting(false);
  };

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">RESEARCH</p>
        <h1 style={{ fontSize: 32 }}>Research reports</h1>
        <p className="subtitle">
          Evidence-backed reports generated from Insight&apos;s collected data
        </p>
      </div>

      <div className="terminal-main">
        {/* Lens selector */}
        <div className="flex items-center gap-4 mb-4">
          <div className="timeframe-controls">
            {["ecosystem", "defi", "infrastructure"].map((l) => (
              <button
                key={l}
                className={`timeframe-btn ${lens === l ? "active" : ""}`}
                onClick={() => setLens(l)}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              className="t-btn sm"
              onClick={() => exportReport("markdown")}
              disabled={exporting || !report}
            >
              ↓ Markdown
            </button>
            <button
              className="t-btn sm"
              onClick={() => exportReport("json")}
              disabled={exporting || !report}
            >
              ↓ JSON
            </button>
            <button
              className="t-btn sm"
              onClick={() => exportReport("pdf")}
              disabled={exporting || !report}
            >
              ↓ PDF
            </button>
          </div>
        </div>

        {loading && <div className="t-loading">Loading report...</div>}

        {!loading && report && (
          <>
            {/* Report metadata */}
            <div className="terminal-grid terminal-grid-4 mb-4">
              <div className="metric-card">
                <span className="metric-label">Confidence</span>
                <span className="metric-value-sm">{report.confidence}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Evidence</span>
                <span className="metric-value-sm">{evidenceCount}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Generated</span>
                <span className="metric-value-sm" style={{ fontSize: 14 }}>
                  {new Date(report.generatedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Data Mode</span>
                <span className="metric-value-sm">
                  <span className={`t-badge ${report.isDemo ? "yellow" : "green"}`}>
                    {report.isDemo ? "DEMO" : "LIVE"}
                  </span>
                </span>
              </div>
            </div>

            {/* Report content */}
            <div className="t-card">
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px" }}>{report.title}</h2>

              <div className="terminal-section">
                <div className="t-card-title">Executive Summary</div>
                <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>
                  {report.sections.thesis}
                </p>
              </div>

              {report.sections.catalyst && (
                <div className="terminal-section">
                  <div className="t-card-title">What Could Matter Next</div>
                  <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>
                    {report.sections.catalyst}
                  </p>
                </div>
              )}

              {report.sections.risk && (
                <div className="terminal-section">
                  <div className="t-card-title">Research Caveat</div>
                  <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>
                    {report.sections.risk}
                  </p>
                </div>
              )}

              <div className="terminal-section">
                <div className="t-card-title">Evidence</div>
                <p className="text-sm mt-2 text-muted">
                  {evidenceCount} evidence items support this report.
                </p>
                <Link href="/evidence" className="t-card-link mt-2">
                  View evidence timeline →
                </Link>
              </div>
            </div>

            {/* Quick links */}
            <div className="terminal-grid terminal-grid-3 mt-4">
              <Link href="/history" className="t-card" style={{ textDecoration: "none" }}>
                <div className="t-card-title">Snapshot History</div>
                <p className="text-sm mt-2">Compare snapshots and track changes over time →</p>
              </Link>
              <Link href="/trends" className="t-card" style={{ textDecoration: "none" }}>
                <div className="t-card-title">Trend Analysis</div>
                <p className="text-sm mt-2">Project trends and multi-project overlay →</p>
              </Link>
              <Link href="/assistant" className="t-card" style={{ textDecoration: "none" }}>
                <div className="t-card-title">Ask Insight</div>
                <p className="text-sm mt-2">AI-powered analysis grounded in data →</p>
              </Link>
            </div>
          </>
        )}

        {!loading && !report && (
          <div className="t-empty">No report available for lens &quot;{lens}&quot;.</div>
        )}
      </div>
    </div>
  );
}
