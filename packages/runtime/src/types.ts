import type { Evidence, Narrative, Project, Report, ReportLens } from "@insight/core";
import type { ProjectRepository } from "@insight/data";
import type { Bounds } from "@insight/intelligence";
import type { KnowledgeGraph } from "@insight/knowledge";

/**
 * Runtime contracts.
 *
 * The runtime layer only orchestrates: it wires data → intelligence →
 * knowledge, and composes results. It owns no business logic of its own.
 * All inputs are explicit so every output is deterministic.
 */

/** Options accepted by every runtime entry point. */
export interface RuntimeOptions {
  /** Fixed reference timestamp (ISO-8601). Never Date.now(). */
  referenceDate: string;
  /** Scoring bounds; defaults to intelligence DEFAULT_BOUNDS. */
  bounds?: Bounds;
  /** Research lens for report generation. Defaults to "ecosystem". */
  lens?: ReportLens;
  /** Repository to load data from. Defaults to the demo repository. */
  repository?: ProjectRepository;
}

/** High-level counts describing a runtime result. */
export interface RuntimeSummary {
  projectCount: number;
  narrativeCount: number;
  evidenceCount: number;
  graphEntityCount: number;
  graphRelationshipCount: number;
}

/** The complete, deterministic output of a runtime run. */
export interface RuntimeResult {
  projects: Project[];
  narratives: Narrative[];
  evidence: Evidence[];
  knowledgeGraph: KnowledgeGraph;
  report: Report;
  summary: RuntimeSummary;
  /** Input reference timestamp — deterministic by contract. */
  timestamp: string;
}

/** Dashboard-shaped projection of a runtime result. */
export interface RuntimeDashboard {
  projects: Project[];
  narratives: Narrative[];
  report: Report;
  knowledgeGraph: KnowledgeGraph;
  summary: RuntimeSummary;
  timestamp: string;
}
