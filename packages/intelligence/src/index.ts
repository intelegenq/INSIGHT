/**
 * @insight/intelligence — deterministic intelligence engine.
 *
 * Pure, dependency-light engines that turn evidence and project data into
 * health profiles, narratives, and reports. No React, no Next.js, no
 * external APIs, no randomness, no I/O.
 *
 * Depends only on @insight/core (types + deterministic scoring) and
 * @insight/data (fixtures and repository contracts).
 */

export type {
  Bounds,
  DerivedNarrative,
  Defaults,
  EvidenceFeedRecord,
  ProjectHealth,
  ScoredProject,
} from "./types";

export {
  STATUS_WEIGHT,
  bestEvidence,
  deduplicateContent,
  deduplicateEvidence,
  normalizeEvidence,
  weightEvidence,
} from "./engines/evidenceEngine";

export { DEFAULT_BOUNDS, scoreProject, scoreProjects } from "./engines/projectHealthEngine";

export {
  deriveCategoryNarrative,
  deriveNarrativeForProject,
  deriveNarratives,
} from "./engines/narrativeEngine";

export { generateReport } from "./engines/reportEngine";

/* ── Signal Engine (Milestone 11) ────────────────────────────────────── */
export { SignalEngine, CorrelationEngine, ConfidenceCalculator } from "./signals";

export type {
  IntelligenceSignal,
  SignalEvidence,
  CorrelationResult,
  SignalEngineConfig,
  CorrelationRule,
  ConfidenceInput,
  SignalType,
} from "./signals/SignalTypes";

export { SIGNAL_TYPES } from "./signals/SignalTypes";

/* ── Anomaly Detection ──────────────────────────────────────────────── */
export { detectAnomalies, detectEvidenceAnomalies } from "./anomalyDetector";
export type { Anomaly, AnomalyThresholds } from "./anomalyDetector";
