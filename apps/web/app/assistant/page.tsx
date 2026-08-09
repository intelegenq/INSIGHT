"use client";

import Link from "next/link";
import { useState, useCallback } from "react";

interface Citation {
  evidenceId: string;
  source: string;
  status: string;
  note: string;
  reference?: string;
}

interface ProjectReference {
  id: string;
  name: string;
  category: string;
  description: string;
  chain?: string;
}

interface NarrativeReference {
  id: string;
  name: string;
  trend: string;
  change?: string;
  note: string;
}

interface ReportReference {
  id: string;
  title: string;
  lens: string;
  confidence: string;
}

interface AssistantMetadata {
  providerUsed: boolean;
  providerName: string;
  contextSize: number;
  hasSufficientData: boolean;
  timestamp: string;
}

interface AssistantApiResponse {
  answer: string;
  citations: Citation[];
  projects: ProjectReference[];
  narratives: NarrativeReference[];
  reports: ReportReference[];
  metadata: AssistantMetadata;
}

type LoadState = "idle" | "loading" | "success" | "error";

export default function AssistantPage() {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<LoadState>("idle");
  const [response, setResponse] = useState<AssistantApiResponse | null>(null);
  const [error, setError] = useState<string>("");

  const ask = useCallback(async () => {
    if (message.trim().length === 0) return;
    setState("loading");
    setError("");
    setResponse(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as AssistantApiResponse;
      setResponse(data);
      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, [message]);

  return (
    <div className="page">
      <nav className="nav" aria-label="Primary navigation">
        <Link href="/" className="nav-brand">
          Insight
        </Link>
        <div className="nav-links">
          <Link href="/projects">Projects</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant" className="active">
            Assistant
          </Link>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
        </div>
      </nav>

      <main className="hero">
        <h1>AI Assistant</h1>
        <p className="subtitle">
          Ask questions about Insight&apos;s collected data. The AI is grounded in Insight&apos;s
          deterministic evidence — no web search, no invented facts.
        </p>

        <div className="assistant-input-row">
          <textarea
            className="assistant-input"
            placeholder="Ask about projects, narratives, ecosystem health..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                void ask();
              }
            }}
            rows={3}
            disabled={state === "loading"}
          />
          <button
            className="primary-button"
            onClick={() => void ask()}
            disabled={state === "loading" || message.trim().length === 0}
          >
            {state === "loading" ? "Thinking..." : "Ask"}
          </button>
        </div>

        {state === "error" && (
          <div className="assistant-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {state === "success" && response && <AssistantResponse data={response} />}

        {state === "idle" && (
          <div className="assistant-suggestions">
            <p className="muted">Try asking:</p>
            <button
              className="suggestion-chip"
              onClick={() => setMessage("What is the current state of the Solana ecosystem?")}
            >
              What is the current state of the Solana ecosystem?
            </button>
            <button
              className="suggestion-chip"
              onClick={() => setMessage("Which projects have the highest TVL?")}
            >
              Which projects have the highest TVL?
            </button>
            <button
              className="suggestion-chip"
              onClick={() => setMessage("What narratives are trending up?")}
            >
              What narratives are trending up?
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function AssistantResponse({ data }: { data: AssistantApiResponse }) {
  return (
    <div className="assistant-response">
      <div className="assistant-answer">
        <h3>Answer</h3>
        <p className="answer-text">{data.answer}</p>
      </div>

      {data.citations.length > 0 && (
        <div className="assistant-section">
          <h4>Citations ({data.citations.length})</h4>
          <ul className="citation-list">
            {data.citations.map((c) => (
              <li key={c.evidenceId} className="citation-item">
                <span className={`evidence-badge ${c.status}`}>{c.status}</span>
                <span className="citation-source">{c.source}</span>
                <span className="citation-note">{c.note}</span>
                {c.reference && (
                  <a
                    href={c.reference}
                    className="citation-ref"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    source ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.projects.length > 0 && (
        <div className="assistant-section">
          <h4>Relevant Projects ({data.projects.length})</h4>
          <ul className="ref-list">
            {data.projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="ref-link">
                  <strong>{p.name}</strong> ({p.category})
                </Link>
                <span className="ref-desc">{p.description}</span>
                {p.chain && <span className="ref-chain">{p.chain}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.narratives.length > 0 && (
        <div className="assistant-section">
          <h4>Relevant Narratives ({data.narratives.length})</h4>
          <ul className="ref-list">
            {data.narratives.map((n) => (
              <li key={n.id}>
                <Link href="/narratives" className="ref-link">
                  <strong>{n.name}</strong>{" "}
                  <span className={`trend-badge ${n.trend}`}>{n.trend}</span>
                  {n.change && <span className="narrative-change">{n.change}</span>}
                </Link>
                <span className="ref-desc">{n.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.reports.length > 0 && (
        <div className="assistant-section">
          <h4>Relevant Reports ({data.reports.length})</h4>
          <ul className="ref-list">
            {data.reports.map((r) => (
              <li key={r.id}>
                <Link href="/reports" className="ref-link">
                  <strong>{r.title}</strong>
                </Link>
                <span className="ref-desc">
                  Lens: {r.lens} · Confidence: {r.confidence}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="assistant-meta">
        <span>Provider: {data.metadata.providerName}</span>
        <span>Context items: {data.metadata.contextSize}</span>
        <span>{data.metadata.hasSufficientData ? "✓ Sufficient data" : "⚠ Insufficient data"}</span>
        <span>{new Date(data.metadata.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
