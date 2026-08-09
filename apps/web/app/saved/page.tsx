"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface SavedItem {
  id: string;
  [key: string]: unknown;
}

interface SavedData {
  reports: SavedItem[];
  narratives: SavedItem[];
  projects: SavedItem[];
  sessions: SavedItem[];
}

type LoadState = "idle" | "loading" | "success" | "error";

export default function SavedPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<SavedData | null>(null);
  const [error, setError] = useState("");

  const loadSaved = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/saved");
      if (res.status === 401) {
        setState("error");
        setError("Please sign in to view your saved research.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as SavedData;
      setData(json);
      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const removeItem = useCallback(
    async (kind: string, id: string) => {
      try {
        const res = await fetch(`/api/saved?kind=${kind}&id=${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          void loadSaved();
        }
      } catch {
        // ignore
      }
    },
    [loadSaved],
  );

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
          <Link href="/assistant">Assistant</Link>
          <Link href="/history">History</Link>
          <span className="nav-active">Saved</span>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
        </div>
      </nav>

      <main className="hero">
        <h1>Saved Research</h1>
        <p className="subtitle">Your saved reports, narratives, projects, and research sessions.</p>

        {state === "loading" && <p className="muted">Loading...</p>}

        {state === "error" && (
          <div className="auth-error">
            {error}
            <div style={{ marginTop: 12 }}>
              <Link href="/login" className="primary-button inline-button">
                Sign in
              </Link>
            </div>
          </div>
        )}

        {state === "success" && data && (
          <div className="saved-grid">
            <SavedSection
              title="Reports"
              items={data.reports}
              kind="report"
              onRemove={removeItem}
              renderItem={(item) => (
                <Link href="/reports" className="ref-link">
                  <strong>{String(item.title ?? item.reportId ?? "Untitled")}</strong>
                  <span className="ref-desc">Lens: {String(item.lens ?? "ecosystem")}</span>
                </Link>
              )}
            />
            <SavedSection
              title="Narratives"
              items={data.narratives}
              kind="narrative"
              onRemove={removeItem}
              renderItem={(item) => (
                <Link href="/narratives" className="ref-link">
                  <strong>{String(item.name ?? item.narrativeId ?? "Untitled")}</strong>
                </Link>
              )}
            />
            <SavedSection
              title="Projects"
              items={data.projects}
              kind="project"
              onRemove={removeItem}
              renderItem={(item) => (
                <Link href={`/projects/${String(item.projectId ?? "")}`} className="ref-link">
                  <strong>{String(item.name ?? item.projectId ?? "Untitled")}</strong>
                </Link>
              )}
            />
            <SavedSection
              title="Sessions"
              items={data.sessions}
              kind="session"
              onRemove={removeItem}
              renderItem={(item) => (
                <div>
                  <strong>{String(item.title ?? "Untitled session")}</strong>
                  <span className="ref-desc">Lens: {String(item.lens ?? "ecosystem")}</span>
                </div>
              )}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function SavedSection({
  title,
  items,
  kind,
  onRemove,
  renderItem,
}: {
  title: string;
  items: SavedItem[];
  kind: string;
  onRemove: (kind: string, id: string) => void;
  renderItem: (item: SavedItem) => React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="saved-card">
        <h3>{title}</h3>
        <p className="muted">Nothing saved yet.</p>
      </div>
    );
  }
  return (
    <div className="saved-card">
      <h3>
        {title} ({items.length})
      </h3>
      <ul className="ref-list">
        {items.map((item) => (
          <li key={item.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {renderItem(item)}
              <button
                className="remove-button"
                onClick={() => void onRemove(kind, item.id)}
                aria-label={`Remove ${kind}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
