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
  ResearchSession,
  SavedNarrative,
  SavedProject,
  SavedReport,
  SavedResearch,
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
  return { reports: [], narratives: [], projects: [], sessions: [] };
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

  /** Save (or replace) a report reference. */
  saveReport(reportId: string, lens: ReportLens, title: string): SavedReport {
    const existing = this.data.reports.find((r) => r.reportId === reportId);
    const saved: SavedReport =
      existing ??
      { id: newId("srep"), userId: this.userId, reportId, lens, title, savedAt: nowIso() };
    if (!existing) this.data.reports.push(saved);
    this.persist();
    return saved;
  }

  /** Save a narrative reference. */
  saveNarrative(narrativeId: string, name: string): SavedNarrative {
    const existing = this.data.narratives.find((n) => n.narrativeId === narrativeId);
    const saved: SavedNarrative =
      existing ??
      { id: newId("snav"), userId: this.userId, narrativeId, name, savedAt: nowIso() };
    if (!existing) this.data.narratives.push(saved);
    this.persist();
    return saved;
  }

  /** Save a project reference. */
  saveProject(projectId: string, name: string): SavedProject {
    const existing = this.data.projects.find((p) => p.projectId === projectId);
    const saved: SavedProject =
      existing ??
      { id: newId("sproj"), userId: this.userId, projectId, name, savedAt: nowIso() };
    if (!existing) this.data.projects.push(saved);
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
} {
  return {
    reportCount: saved.reports.length,
    narrativeCount: saved.narratives.length,
    projectCount: saved.projects.length,
    sessionCount: saved.sessions.length,
  };
}