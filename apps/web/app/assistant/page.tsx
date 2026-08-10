"use client";

import Link from "next/link";
import { useState, useCallback, useRef, useEffect } from "react";
import { useCopilot } from "../../components/Copilot";

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

interface GraphEntityReference {
  kind: string;
  id: string;
  name?: string;
}

interface HealthReference {
  projectId: string;
  projectName: string;
  health: number;
  momentum: number;
  risk: number;
  developer: number;
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
  graphEntities: GraphEntityReference[];
  healthScores: HealthReference[];
  pulse: {
    totalProjects: number;
    totalNarratives: number;
    totalEvidence: number;
    generatedAt: string;
  } | null;
  snapshotCount: number;
  metadata: AssistantMetadata;
}

interface ConversationEntry {
  id: string;
  question: string;
  response: AssistantApiResponse;
}

type LoadState = "idle" | "loading" | "success" | "error";

const SUGGESTIONS = [
  "What is the current state of the Solana ecosystem?",
  "Which projects have the highest TVL?",
  "What narratives are trending up?",
  "Compare project health scores",
  "What evidence supports the top projects?",
  "What does the knowledge graph show?",
  "How has the ecosystem changed over time?",
  "Are there any risk signals in the data?",
];

function trendLabel(trend: string): string {
  switch (trend) {
    case "up":
      return "↑ Up";
    case "down":
      return "↓ Down";
    case "flat":
      return "→ Flat";
    case "watch":
      return "⊙ Watch";
    default:
      return trend;
  }
}

function trendClass(trend: string): string {
  switch (trend) {
    case "up":
      return "trend-up";
    case "down":
      return "trend-down";
    case "flat":
      return "trend-flat";
    case "watch":
      return "trend-watch";
    default:
      return "trend-flat";
  }
}

function healthColor(score: number): string {
  if (score >= 70) return "#2e7d32";
  if (score >= 50) return "#e65100";
  return "#c62828";
}

export default function AssistantPage() {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");
  const [history, setHistory] = useState<ConversationEntry[]>([]);
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Assistant] User is in the full AI assistant workspace with conversation history.",
    );
  }, [setPageContext]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = useCallback(async (question: string) => {
    if (question.trim().length === 0) return;
    setState("loading");
    setError("");

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as AssistantApiResponse;
      const entry: ConversationEntry = {
        id: `conv_${Date.now()}`,
        question,
        response: data,
      };
      setHistory((prev) => [...prev, entry]);
      setState("success");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(message);
  };

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
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/trends">Trends</Link>
          <Link href="/evidence">Evidence</Link>
          <Link href="/graph">Graph</Link>
        </div>
      </nav>

      <main className="hero assistant-hero">
        <h1>AI Assistant</h1>
        <p className="subtitle">
          Ask questions about Insight&apos;s collected data. The AI is grounded in Insight&apos;s
          deterministic evidence — no web search, no invented facts.
        </p>

        {/* Conversation history */}
        {history.length > 0 && (
          <div className="assistant-conversation" ref={scrollRef}>
            {history.map((entry) => (
              <div key={entry.id} className="assistant-conversation-entry">
                <div className="assistant-question">
                  <strong>You:</strong> {entry.question}
                </div>
                <AssistantResponse data={entry.response} />
              </div>
            ))}
          </div>
        )}

        {state === "error" && (
          <div className="assistant-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Input form */}
        <form className="assistant-input-row" onSubmit={handleSubmit}>
          <textarea
            className="assistant-input"
            placeholder="Ask about projects, narratives, ecosystem health, trends, evidence..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void ask(message);
              }
            }}
            rows={3}
            disabled={state === "loading"}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={state === "loading" || message.trim().length === 0}
          >
            {state === "loading" ? "Thinking..." : "Ask →"}
          </button>
        </form>

        {/* Suggestion chips */}
        {state === "idle" && history.length === 0 && (
          <div className="assistant-suggestions">
            <p className="muted">Try asking:</p>
            <div className="suggestion-grid">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
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
        <strong>Assistant:</strong>
        <p className="answer-text">{data.answer}</p>
      </div>

      {/* Health scores */}
      {data.healthScores.length > 0 && (
        <div className="assistant-section">
          <h4>Health Scores ({data.healthScores.length})</h4>
          <div className="health-score-grid">
            {data.healthScores.map((h) => (
              <Link
                href={`/projects/${h.projectId}`}
                key={h.projectId}
                className="health-score-card"
              >
                <span className="health-score-name">{h.projectName}</span>
                <span className="health-score-value" style={{ color: healthColor(h.health) }}>
                  {h.health.toFixed(0)}
                </span>
                <span className="health-score-detail">
                  M: {h.momentum.toFixed(0)} R: {h.risk.toFixed(0)} D: {h.developer.toFixed(0)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Citations */}
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

      {/* Projects */}
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

      {/* Narratives */}
      {data.narratives.length > 0 && (
        <div className="assistant-section">
          <h4>Relevant Narratives ({data.narratives.length})</h4>
          <ul className="ref-list">
            {data.narratives.map((n) => (
              <li key={n.id}>
                <Link href={`/narratives/${n.id}`} className="ref-link">
                  <strong>{n.name}</strong>{" "}
                  <span className={`trend-badge ${trendClass(n.trend)}`}>
                    {trendLabel(n.trend)}
                  </span>
                  {n.change && <span className="narrative-change">{n.change}</span>}
                </Link>
                <span className="ref-desc">{n.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Graph entities */}
      {data.graphEntities.length > 0 && (
        <div className="assistant-section">
          <h4>Knowledge Graph Entities ({data.graphEntities.length})</h4>
          <div className="graph-entity-chips">
            {data.graphEntities.map((g) => (
              <Link href={`/graph`} key={g.id} className="graph-entity-chip">
                <span className="graph-entity-kind">{g.kind}</span>
                <span className="graph-entity-name">{g.name ?? g.id}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reports */}
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

      {/* Pulse */}
      {data.pulse && (
        <div className="assistant-section">
          <h4>Ecosystem Pulse</h4>
          <div className="pulse-row">
            <span>{data.pulse.totalProjects} projects</span>
            <span>{data.pulse.totalNarratives} narratives</span>
            <span>{data.pulse.totalEvidence} evidence items</span>
            {data.snapshotCount > 0 && <span>{data.snapshotCount} snapshots</span>}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="assistant-meta">
        <span>AI: {data.metadata.providerUsed ? "connected" : "offline"}</span>
        <span>Context: {data.metadata.contextSize} items</span>
        <span>{data.metadata.hasSufficientData ? "✓ Sufficient data" : "⚠ Insufficient data"}</span>
        <span>{new Date(data.metadata.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
