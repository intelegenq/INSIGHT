"use client";

import Link from "next/link";
import { use, useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../../components/Copilot";

interface SessionData {
  session: {
    id: string;
    title: string;
    lens: string;
    reportId?: string;
    narrativeIds: string[];
    projectIds: string[];
    createdAt: string;
    updatedAt: string;
  };
}

interface ProjectOption {
  id: string;
  name: string;
}

interface NarrativeOption {
  id: string;
  name: string;
}

type LoadState = "idle" | "loading" | "success" | "error";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionData["session"] | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [narratives, setNarratives] = useState<NarrativeOption[]>([]);
  const [addProjectId, setAddProjectId] = useState("");
  const [addNarrativeId, setAddNarrativeId] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.status === 401) {
        setState("error");
        setError("Please sign in to view this session.");
        return;
      }
      if (res.status === 404) {
        setState("error");
        setError("Session not found.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SessionData;
      setSession(data.session);
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to load session");
    }
  }, [id]);

  useEffect(() => {
    void load();
    // Load available projects and narratives for adding
    void (async () => {
      try {
        const [pRes, nRes] = await Promise.all([fetch("/api/projects"), fetch("/api/narratives")]);
        if (pRes.ok) {
          const pData = (await pRes.json()) as { projects: ProjectOption[] };
          setProjects(pData.projects);
        }
        if (nRes.ok) {
          const nData = (await nRes.json()) as { narratives: NarrativeOption[] };
          setNarratives(nData.narratives);
        }
      } catch {
        // ignore
      }
    })();
  }, [load]);

  const patchSession = useCallback(
    async (
      action: "addProject" | "removeProject" | "addNarrative" | "removeNarrative",
      payload: { projectId?: string; narrativeId?: string },
    ) => {
      try {
        const res = await fetch(`/api/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        });
        if (res.ok) {
          const data = (await res.json()) as SessionData;
          setSession(data.session);
        }
      } catch {
        // ignore
      }
    },
    [id],
  );

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <div className="nav-links">
          <Link href="/projects">Projects</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/history">History</Link>
          <Link href="/saved">Saved</Link>
          <Link href="/search">Search</Link>
          <Link href="/trends">Trends</Link>
          <Link href="/evidence">Evidence</Link>
        </div>
      </nav>

      <section className="hero">
        {state === "loading" && <p className="muted">Loading session…</p>}
        {state === "error" && (
          <div className="auth-error">
            {error}
            <div style={{ marginTop: 12 }}>
              <Link href="/saved" className="primary-button inline-button">
                ← Back to Saved
              </Link>
            </div>
          </div>
        )}

        {state === "success" && session && (
          <>
            <p className="eyebrow">RESEARCH SESSION</p>
            <h1>{session.title}</h1>
            <div className="session-detail-card">
              <div className="session-meta-row">
                <span>Lens: {session.lens}</span>
                <span>Created: {new Date(session.createdAt).toLocaleDateString()}</span>
                <span>Updated: {new Date(session.updatedAt).toLocaleDateString()}</span>
              </div>
              {session.reportId && (
                <div style={{ marginTop: 12 }}>
                  <Link href="/reports" className="ref-link">
                    <strong>Linked report: {session.reportId}</strong>
                  </Link>
                </div>
              )}
            </div>

            {/* Projects in session */}
            <div className="saved-card">
              <h3>Projects ({session.projectIds.length})</h3>
              <ul className="session-items-list">
                {session.projectIds.map((pid) => (
                  <li key={pid}>
                    <Link href={`/projects/${pid}`} className="ref-link">
                      <strong>{pid}</strong>
                    </Link>
                    <button
                      className="remove-button"
                      onClick={() => void patchSession("removeProject", { projectId: pid })}
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {session.projectIds.length === 0 && (
                  <li style={{ color: "var(--muted)" }}>No projects in this session yet.</li>
                )}
              </ul>
              {projects.length > 0 && (
                <div className="session-add-form">
                  <select value={addProjectId} onChange={(e) => setAddProjectId(e.target.value)}>
                    <option value="">Add a project…</option>
                    {projects
                      .filter((p) => !session.projectIds.includes(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!addProjectId}
                    onClick={() => {
                      if (addProjectId) {
                        void patchSession("addProject", { projectId: addProjectId });
                        setAddProjectId("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Narratives in session */}
            <div className="saved-card">
              <h3>Narratives ({session.narrativeIds.length})</h3>
              <ul className="session-items-list">
                {session.narrativeIds.map((nid) => (
                  <li key={nid}>
                    <Link href={`/narratives/${nid}`} className="ref-link">
                      <strong>{nid}</strong>
                    </Link>
                    <button
                      className="remove-button"
                      onClick={() => void patchSession("removeNarrative", { narrativeId: nid })}
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {session.narrativeIds.length === 0 && (
                  <li style={{ color: "var(--muted)" }}>No narratives in this session yet.</li>
                )}
              </ul>
              {narratives.length > 0 && (
                <div className="session-add-form">
                  <select
                    value={addNarrativeId}
                    onChange={(e) => setAddNarrativeId(e.target.value)}
                  >
                    <option value="">Add a narrative…</option>
                    {narratives
                      .filter((n) => !session.narrativeIds.includes(n.id))
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!addNarrativeId}
                    onClick={() => {
                      if (addNarrativeId) {
                        void patchSession("addNarrative", { narrativeId: addNarrativeId });
                        setAddNarrativeId("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginTop: 24 }}>
              <Link href="/saved" className="ghost-button">
                ← Back to Saved Research
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
