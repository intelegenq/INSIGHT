"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface AlertItem {
  id: string;
  targetType: "project" | "narrative";
  targetId: string;
  targetName: string;
  condition: string;
  threshold?: number;
  status: "active" | "triggered" | "removed";
  createdAt: string;
  triggeredAt?: string;
  triggerHistory: {
    triggeredAt: string;
    oldValue: number;
    newValue: number;
    description: string;
  }[];
}

interface SavedData {
  alerts: AlertItem[];
  projects: { id: string; name: string }[];
  narratives: { id: string; name: string }[];
}

type LoadState = "idle" | "loading" | "success" | "error";

const CONDITION_LABELS: Record<string, string> = {
  health_drop: "Health drops below",
  health_rise: "Health rises above",
  trend_change: "Trend changes",
  new_evidence: "New evidence added",
  tvl_change: "TVL changes by %",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [narratives, setNarratives] = useState<{ id: string; name: string }[]>([]);
  const [newTargetType, setNewTargetType] = useState<"project" | "narrative">("project");
  const [newTargetId, setNewTargetId] = useState("");
  const [newCondition, setNewCondition] = useState("health_drop");
  const [newThreshold, setNewThreshold] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/saved");
      if (res.status === 401) {
        setState("error");
        setError("Please sign in to manage alerts.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SavedData;
      setAlerts(data.alerts ?? []);
      setProjects(data.projects ?? []);
      setNarratives(data.narratives ?? []);
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createAlert = useCallback(async () => {
    if (!newTargetId) return;
    try {
      const target =
        newTargetType === "project"
          ? projects.find((p) => p.id === newTargetId)
          : narratives.find((n) => n.id === newTargetId);
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "alert",
          alert: {
            targetType: newTargetType,
            targetId: newTargetId,
            targetName: target?.name ?? newTargetId,
            condition: newCondition,
            threshold: newThreshold ? Number(newThreshold) : undefined,
          },
        }),
      });
      if (res.ok) {
        await load();
        setNewTargetId("");
        setNewThreshold("");
      }
    } catch {
      // ignore
    }
  }, [newTargetId, newTargetType, newCondition, newThreshold, projects, narratives, load]);

  const removeAlert = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/saved?kind=alert&id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // ignore
    }
  }, []);

  const targets = newTargetType === "project" ? projects : narratives;

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
          <Link href="/saved">Saved</Link>
          <Link href="/search">Search</Link>
          <Link href="/trends">Trends</Link>
          <Link href="/evidence">Evidence</Link>
          <span className="nav-active">Alerts</span>
        </div>
      </nav>

      <main className="hero">
        <h1>Alert Subscriptions</h1>
        <p className="subtitle">
          Subscribe to changes in project health, trends, evidence, and TVL. Alerts trigger when
          conditions are met on new snapshots.
        </p>

        {state === "loading" && <p className="muted">Loading alerts…</p>}
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

        {state === "success" && (
          <>
            {/* Create alert form */}
            <div className="session-detail-card">
              <h3>Create a new alert</h3>
              <div className="session-add-form">
                <select
                  value={newTargetType}
                  onChange={(e) => {
                    setNewTargetType(e.target.value as "project" | "narrative");
                    setNewTargetId("");
                  }}
                >
                  <option value="project">Project</option>
                  <option value="narrative">Narrative</option>
                </select>
                <select value={newTargetId} onChange={(e) => setNewTargetId(e.target.value)}>
                  <option value="">Select {newTargetType}…</option>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select value={newCondition} onChange={(e) => setNewCondition(e.target.value)}>
                  {Object.entries(CONDITION_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="threshold"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  style={{
                    width: 100,
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--surface)",
                    color: "var(--text)",
                  }}
                />
                <button
                  type="button"
                  className="primary-button"
                  disabled={!newTargetId}
                  onClick={createAlert}
                >
                  Create alert
                </button>
              </div>
            </div>

            {/* Alert list */}
            {alerts.length === 0 ? (
              <p className="muted">No alerts configured. Create one above.</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="alert-card">
                  <div className="alert-card-info">
                    <div className="alert-card-type">
                      {CONDITION_LABELS[alert.condition] ?? alert.condition}
                      {alert.threshold !== undefined && ` ${alert.threshold}`}
                    </div>
                    <div className="alert-card-target">
                      {alert.targetType}:{" "}
                      <Link
                        href={`/${alert.targetType === "project" ? "projects" : "narratives"}/${alert.targetId}`}
                      >
                        {alert.targetName}
                      </Link>
                    </div>
                    <div className="alert-card-condition">
                      Created {new Date(alert.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className={`alert-status-badge alert-status-${alert.status}`}>
                      {alert.status}
                    </span>
                    <button className="remove-button" onClick={() => void removeAlert(alert.id)}>
                      ✕
                    </button>
                  </div>
                  {alert.triggerHistory.length > 0 && (
                    <div className="alert-trigger-log" style={{ width: "100%", marginTop: 8 }}>
                      <strong>Trigger history:</strong>
                      {alert.triggerHistory.slice(-5).map((t, i) => (
                        <div key={i} className="alert-trigger-entry">
                          {new Date(t.triggeredAt).toLocaleString()}: {t.description} ({t.oldValue}{" "}
                          → {t.newValue})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </main>
    </div>
  );
}
