/**
 * M25 — Authentication & Saved Research domain types.
 *
 * Framework-free vocabulary for user authentication, research sessions, and
 * saved reports/narratives/projects. No React, no external dependencies.
 */

import type { Narrative, Project, Report, ReportLens } from "./types";

/** A registered Insight user. */
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

/** Internal credential record — stores only a salted password hash. */
export interface UserCredential extends User {
  passwordHash: string;
}

/** An active authentication session. */
export interface AuthSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

/** A report the user has saved for later reference. */
export interface SavedReport {
  id: string;
  userId: string;
  reportId: string;
  lens: ReportLens;
  title: string;
  savedAt: string;
}

/** A narrative the user has saved. */
export interface SavedNarrative {
  id: string;
  userId: string;
  narrativeId: string;
  name: string;
  savedAt: string;
}

/** A project the user has saved. */
export interface SavedProject {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  savedAt: string;
}

/** A persisted research session collecting related saved items. */
export interface ResearchSession {
  id: string;
  userId: string;
  title: string;
  lens: ReportLens;
  reportId?: string;
  narrativeIds: string[];
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** The full saved-research surface for one user. */
export interface SavedResearch {
  reports: SavedReport[];
  narratives: SavedNarrative[];
  projects: SavedProject[];
  sessions: ResearchSession[];
}

export type { Report, Project, Narrative };