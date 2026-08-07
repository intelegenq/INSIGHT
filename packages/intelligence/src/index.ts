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
