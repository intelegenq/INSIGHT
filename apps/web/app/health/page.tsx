"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface ProviderHealthEntry {
  id: string;
  name: string;
  available: boolean;
  note?: string;
  status: "healthy" | "degraded" | "unavailable";
}

interface HealthReport {
  status: "healthy" | "degraded" | "unavailable";
  checkedAt: string;
  providers: ProviderHealthEntry[];
  summary: {
    total: number;
    healthy: number;
    unavailable: number;
  };
}

type LoadState = "idle" | "loading" | "success" | "error";

const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "";

export default function HealthPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState("");

  const checkHealth = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HealthReport;
      setReport(data);
      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  function statusLabel(status: string): string {
    switch (status) {
      case "healthy":
        return "✓ Healthy";
      case "degraded":
        return "⚠ Degraded";
      case "unavailable":
        return "✕ Unavailable";
      default:
        return status;
    }
  }

  function statusClass(status: string): string {
    switch (status) {
      case "healthy":
        return "health-status healthy";
      case "degraded":
        return "health-status degraded";
      case "unavailable":
        return "health-status unavailable";
      default:
        return "health-status";
    }
  }

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
          <Link href="/graph">Graph</Link>
          <Link href="/health" className="nav-active">
            Health
          </Link>
          <Link href="/history">History</Link>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/trends">Trends</Link>
        </div>
      </nav>

      <section className="health-hero">
        <p className="eyebrow">SOURCE HEALTH</p>
        <h1>
          Every source,
          <br />
          <em>accounted for.</em>
        </h1>
        <p className="hero-copy">
          Insight&apos;s data quality depends on the availability of its upstream providers. Each
          source is health-checked — unavailable providers are reported, not hidden.
        </p>
        <button
          className="primary-button"
          onClick={() => void checkHealth()}
          disabled={state === "loading"}
        >
          {state === "loading" ? "Checking..." : "Re-check"} <span>↻</span>
        </button>
      </section>

      {state === "error" && (
        <section className="section">
          <div className="assistant-error">
            <strong>Error:</strong> {error}
          </div>
        </section>
      )}

      {state === "success" && report && (
        <>
          <section className="section" aria-labelledby="health-summary-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">HEALTH SUMMARY</p>
                <h2 id="health-summary-title">Overall status</h2>
              </div>
              <p className="as-of">Checked · {new Date(report.checkedAt).toLocaleString()}</p>
            </div>
            <div className="metric-grid">
              <article className="metric-card" key="total">
                <span>Providers</span>
                <strong>{report.summary.total}</strong>
                <small>Total configured sources</small>
              </article>
              <article className="metric-card violet" key="healthy">
                <span>Healthy</span>
                <strong>{report.summary.healthy}</strong>
                <small>Available and responding</small>
              </article>
              <article className="metric-card" key="unavailable">
                <span>Unavailable</span>
                <strong>{report.summary.unavailable}</strong>
                <small>Not responding or errored</small>
              </article>
            </div>
            <div className="overall-status-row">
              <span className={statusClass(report.status)}>{statusLabel(report.status)}</span>
            </div>
          </section>

          <section className="section" aria-labelledby="providers-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PROVIDER DETAILS</p>
                <h2 id="providers-title">Per-source status</h2>
              </div>
            </div>
            <div className="provider-list">
              {report.providers.map((p) => (
                <article className="provider-card" key={p.id}>
                  <div className="provider-card-header">
                    <h3>{p.name}</h3>
                    <span className={statusClass(p.status)}>{statusLabel(p.status)}</span>
                  </div>
                  <div className="provider-meta">
                    <span className="entity-id">{p.id}</span>
                    {p.note && <span className="provider-note">{p.note}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
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
