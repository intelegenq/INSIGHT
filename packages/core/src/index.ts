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
} from "./types.js";

export {
  confidenceFromEvidence,
  confidenceRange,
  evidenceWeight,
  rankNarratives,
} from "./scoring.js";
