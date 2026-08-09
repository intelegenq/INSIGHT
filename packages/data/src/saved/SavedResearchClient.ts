/**
 * M25 — Saved research service (file-backed persistence).
 *
 * Persists a user's saved reports, narratives, projects, and research
 * sessions as a JSON file under a data directory. No database required for
 * M25; storage survives process restarts. Framework-free, depends only on
 * @insight/core.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  AlertSubscription,
  AlertTrigger,
  ResearchSession,
  SavedNarrative,
  SavedProject,
  SavedReport,
  SavedResearch,
  SavedSearch,
} from "@insight/core";
import type { ReportLens } from "@insight/core";

export interface SavedResearchStore {
  dataDir?: string;
  userId: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function empty(): SavedResearch {
  return { reports: [], narratives: [], projects: [], sessions: [], searches: [], alerts: [] };
}

/**
 * SavedResearchClient — per-user saved-research persistence.
 * Each user instance owns its own JSON file, keeping scoping trivial.
 */
export class SavedResearchClient {
  private readonly dataDir: string;
  private readonly file: string;
  readonly userId: string;
  private data: SavedResearch;

  constructor(options: SavedResearchStore) {
    this.dataDir = options.dataDir ?? join(process.cwd(), ".data", "saved");
    this.userId = options.userId;
    this.file = join(this.dataDir, `${this.userId}.json`);
    mkdirSync(this.dataDir, { recursive: true });
    this.data = this.load();
  }

  /** All saved reports. */
  listReports(): SavedReport[] {
    return [...this.data.reports];
  }

  /** All saved narratives. */
  listNarratives(): SavedNarrative[] {
    return [...this.data.narratives];
  }

  /** All saved projects. */
  listProjects(): SavedProject[] {
    return [...this.data.projects];
  }

  /** All research sessions, newest first. */
  listSessions(): ResearchSession[] {
    return [...this.data.sessions].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  }

  /** All saved searches, newest first. */
  listSearches(): SavedSearch[] {
    return [...this.data.searches].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  }

  /** Save (or replace) a report reference. */
  saveReport(reportId: string, lens: ReportLens, title: string): SavedReport {
    const existing = this.data.reports.find((r) => r.reportId === reportId);
    const saved: SavedReport = existing ?? {
      id: newId("srep"),
      userId: this.userId,
      reportId,
      lens,
      title,
      savedAt: nowIso(),
    };
    if (!existing) this.data.reports.push(saved);
    this.persist();
    return saved;
  }

  /** Save a narrative reference. */
  saveNarrative(narrativeId: string, name: string): SavedNarrative {
    const existing = this.data.narratives.find((n) => n.narrativeId === narrativeId);
    const saved: SavedNarrative = existing ?? {
      id: newId("snav"),
      userId: this.userId,
      narrativeId,
      name,
      savedAt: nowIso(),
    };
    if (!existing) this.data.narratives.push(saved);
    this.persist();
    return saved;
  }

  /** Save a project reference. */
  saveProject(projectId: string, name: string): SavedProject {
    const existing = this.data.projects.find((p) => p.projectId === projectId);
    const saved: SavedProject = existing ?? {
      id: newId("sproj"),
      userId: this.userId,
      projectId,
      name,
      savedAt: nowIso(),
    };
    if (!existing) this.data.projects.push(saved);
    this.persist();
    return saved;
  }

  /** Save a search query for quick re-execution. */
  saveSearch(query: string, name?: string): SavedSearch {
    const trimmed = query.trim();
    if (trimmed.length === 0) throw new Error("query must not be empty");
    const existing = this.data.searches.find((s) => s.query === trimmed);
    if (existing) return existing;
    const saved: SavedSearch = {
      id: newId("ssrch"),
      userId: this.userId,
      query: trimmed,
      name: name?.trim() || trimmed.slice(0, 60),
      savedAt: nowIso(),
    };
    this.data.searches.push(saved);
    this.persist();
    return saved;
  }

  /** Create a research session scoping related saved items. */
  createSession(input: {
    title: string;
    lens: ReportLens;
    reportId?: string;
    narrativeIds?: string[];
    projectIds?: string[];
  }): ResearchSession {
    const now = nowIso();
    const session: ResearchSession = {
      id: newId("rsess"),
      userId: this.userId,
      title: input.title.trim(),
      lens: input.lens,
      reportId: input.reportId,
      narrativeIds: input.narrativeIds ?? [],
      projectIds: input.projectIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.data.sessions.push(session);
    this.persist();
    return session;
  }

  /** Remove a saved report by its saved-item id. */
  removeReport(id: string): boolean {
    return this.removeWhere((d) => {
      const before = d.reports.length;
      d.reports = d.reports.filter((r) => r.id !== id);
      return d.reports.length !== before;
    });
  }

  /** Remove a saved narrative by its saved-item id. */
  removeNarrative(id: string): boolean {
    return this.removeWhere((d) => {
      const before = d.narratives.length;
      d.narratives = d.narratives.filter((n) => n.id !== id);
      return d.narratives.length !== before;
    });
  }

  /** Remove a saved project by its saved-item id. */
  removeProject(id: string): boolean {
    return this.removeWhere((d) => {
      const before = d.projects.length;
      d.projects = d.projects.filter((p) => p.id !== id);
      return d.projects.length !== before;
    });
  }

  /** Remove a session by id. */
  removeSession(id: string): boolean {
    return this.removeWhere((d) => {
      const before = d.sessions.length;
      d.sessions = d.sessions.filter((s) => s.id !== id);
      return d.sessions.length !== before;
    });
  }

  /** Get a single session by id. */
  getSession(id: string): ResearchSession | undefined {
    return this.data.sessions.find((s) => s.id === id);
  }

  /** Add a project to a session. */
  addProjectToSession(sessionId: string, projectId: string): ResearchSession | undefined {
    const session = this.data.sessions.find((s) => s.id === sessionId);
    if (!session) return undefined;
    if (!session.projectIds.includes(projectId)) {
      session.projectIds.push(projectId);
      session.updatedAt = nowIso();
      this.persist();
    }
    return session;
  }

  /** Remove a project from a session. */
  removeProjectFromSession(sessionId: string, projectId: string): ResearchSession | undefined {
    const session = this.data.sessions.find((s) => s.id === sessionId);
    if (!session) return undefined;
    const before = session.projectIds.length;
    session.projectIds = session.projectIds.filter((p) => p !== projectId);
    if (session.projectIds.length !== before) {
      session.updatedAt = nowIso();
      this.persist();
    }
    return session;
  }

  /** Add a narrative to a session. */
  addNarrativeToSession(sessionId: string, narrativeId: string): ResearchSession | undefined {
    const session = this.data.sessions.find((s) => s.id === sessionId);
    if (!session) return undefined;
    if (!session.narrativeIds.includes(narrativeId)) {
      session.narrativeIds.push(narrativeId);
      session.updatedAt = nowIso();
      this.persist();
    }
    return session;
  }

  /** Remove a narrative from a session. */
  removeNarrativeFromSession(sessionId: string, narrativeId: string): ResearchSession | undefined {
    const session = this.data.sessions.find((s) => s.id === sessionId);
    if (!session) return undefined;
    const before = session.narrativeIds.length;
    session.narrativeIds = session.narrativeIds.filter((n) => n !== narrativeId);
    if (session.narrativeIds.length !== before) {
      session.updatedAt = nowIso();
      this.persist();
    }
    return session;
  }

  /** Remove a saved search by its saved-item id. */
  removeSearch(id: string): boolean {
    return this.removeWhere((d) => {
      const before = d.searches.length;
      d.searches = d.searches.filter((s) => s.id !== id);
      return d.searches.length !== before;
    });
  }

  /** All alert subscriptions, newest first. */
  listAlerts(): AlertSubscription[] {
    return [...this.data.alerts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  /** Create an alert subscription. */
  createAlert(input: {
    targetType: "project" | "narrative";
    targetId: string;
    targetName: string;
    condition: AlertSubscription["condition"];
    threshold?: number;
  }): AlertSubscription {
    const alert: AlertSubscription = {
      id: newId("alert"),
      userId: this.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetName: input.targetName,
      condition: input.condition,
      threshold: input.threshold,
      status: "active",
      createdAt: nowIso(),
      triggerHistory: [],
    };
    this.data.alerts.push(alert);
    this.persist();
    return alert;
  }

  /** Remove an alert subscription. */
  removeAlert(id: string): boolean {
    return this.removeWhere((d) => {
      const before = d.alerts.length;
      d.alerts = d.alerts.filter((a) => a.id !== id);
      return d.alerts.length !== before;
    });
  }

  /** Record a trigger event on an alert. */
  triggerAlert(
    id: string,
    trigger: Omit<AlertTrigger, "triggeredAt">,
  ): AlertSubscription | undefined {
    const alert = this.data.alerts.find((a) => a.id === id);
    if (!alert) return undefined;
    const entry: AlertTrigger = {
      ...trigger,
      triggeredAt: nowIso(),
    };
    alert.triggerHistory.push(entry);
    alert.status = "triggered";
    alert.triggeredAt = nowIso();
    this.persist();
    return alert;
  }

  /** Clear all saved data for this user. */
  clear(): void {
    this.data = empty();
    this.persist();
  }

  private removeWhere(mutate: (draft: SavedResearch) => boolean): boolean {
    const changed = mutate(this.data);
    if (changed) this.persist();
    return changed;
  }

  private load(): SavedResearch {
    if (!existsSync(this.file)) return empty();
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf-8")) as Partial<SavedResearch>;
      return {
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        narratives: Array.isArray(parsed.narratives) ? parsed.narratives : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        searches: Array.isArray(parsed.searches) ? parsed.searches : [],
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      };
    } catch {
      return empty();
    }
  }

  private persist(): void {
    try {
      mkdirSync(this.dataDir, { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch {
      // Best-effort persistence.
    }
  }
}

/** Snapshot of everything saved for a user, for dashboard rendering. */
export function summarize(saved: SavedResearch): {
  reportCount: number;
  narrativeCount: number;
  projectCount: number;
  sessionCount: number;
  searchCount: number;
  alertCount: number;
} {
  return {
    reportCount: saved.reports.length,
    narrativeCount: saved.narratives.length,
    projectCount: saved.projects.length,
    sessionCount: saved.sessions.length,
    searchCount: saved.searches.length,
    alertCount: saved.alerts.length,
  };
}
