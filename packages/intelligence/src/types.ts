import type {
  Confidence,
  Evidence,
  EvidenceSource,
  EvidenceStatus,
  Narrative,
  Project,
  ProjectCategory,
  Report,
  ReportConfidence,
  ReportLens,
} from "@insight/core";

/**
 * Shared contracts for the intelligence engine.
 *
 * All engine outputs are deterministic pure values derived from their
 * inputs; none use I/O, random, or wall-clock time. Reference timestamps
 * are passed in explicitly so results are reproducible.
 */

/** Bounded component scores produced by the project health engine. */
export interface ProjectHealth {
  /** Overall health, bounded 0..100. */
  health: number;
  /** Momentum, bounded -100..100. */
  momentum: number;
  /** Risk, bounded 0..100. */
  risk: number;
  /** Developer activity / velocity score, bounded 0..100. */
  developer: number;
}

/** A project enriched with its health profile and backing evidence. */
export interface ScoredProject {
  project: Project;
  health: ProjectHealth;
  evidence: Evidence[];
}

/** Narrative derived from projects and evidence at a reference time. */
export interface DerivedNarrative {
  narrative: Narrative;
  /** Aggregate momentum backing the narrative, used for stable ranking. */
  momentum: number;
}

/** Raw, loosely-shaped evidence feed before normalization. */
export interface EvidenceFeedRecord {
  id?: string;
  source?: string | Partial<EvidenceSource>;
  note?: string;
  status?: EvidenceStatus;
  observedAt?: string;
  reference?: string;
}

/** Thresholds used to bound scores. Injected so scoring stays deterministic. */
export interface Bounds {
  /** TVL considered "excellent", in USD. */
  maxTvl: number;
  /** 24h volume considered "excellent", in USD. */
  maxVolume: number;
  /** Active users considered "excellent". */
  maxActiveUsers: number;
  /** Developer activity considered "excellent". */
  maxDeveloperActivity: number;
}

export interface Defaults {
  /** Fixed reference timestamp so outputs are reproducible. */
  referenceDate: string;
  /** Denominator scale for score normalization. */
  bounds: Bounds;
}

/* Re-exported convenience types consumed by the engines. */
export type {
  Confidence,
  Evidence,
  EvidenceSource,
  EvidenceStatus,
  Narrative,
  Project,
  ProjectCategory,
  Report,
  ReportConfidence,
  ReportLens,
};
