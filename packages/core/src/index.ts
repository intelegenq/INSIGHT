/**
 * @insight/core — domain foundation for Insight.
 *
 * Framework-free domain entities, evidence contracts, and deterministic
 * scoring utilities. No React, no external dependencies.
 */

export type {
  Confidence,
  Evidence,
  EvidenceSource,
  EvidenceStatus,
  Narrative,
  NarrativeTrend,
  Project,
  ProjectCategory,
  ProjectMetrics,
  Report,
  ReportConfidence,
  ReportLens,
  ReportSections,
} from "./types";

/* ── M25: Authentication & Saved Research ───────────────────────────── */
export type {
  AuthSession,
  ResearchSession,
  SavedNarrative,
  SavedProject,
  SavedReport,
  SavedResearch,
  User,
  UserCredential,
} from "./auth";

export {
  STATUS_WEIGHT,
  VERIFIED_WEIGHT,
  PENDING_WEIGHT,
  DRAFT_WEIGHT,
  DEMO_WEIGHT,
  statusWeight,
  confidenceFromEvidence,
  confidenceRange,
  evidenceWeight,
  rankNarratives,
} from "./scoring";
