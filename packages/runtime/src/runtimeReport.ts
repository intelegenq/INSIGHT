import type { RuntimeDashboard, RuntimeResult, RuntimeSummary } from "./types";
import type { PipelineResult } from "./pipeline";

/**
 * Report — composes the final runtime outputs.
 *
 * Pure composition: builds summaries and projections from an already-run
 * pipeline. No computation of its own.
 */

/** Build a runtime summary from a pipeline result. */
export function buildSummary(result: PipelineResult): RuntimeSummary {
  return {
    projectCount: result.projects.length,
    narrativeCount: result.narratives.length,
    evidenceCount: result.evidence.length,
    graphEntityCount: result.knowledgeGraph.entities.size,
    graphRelationshipCount: result.knowledgeGraph.relationships.length,
  };
}

/** Compose the complete runtime result. */
export function composeRuntimeResult(result: PipelineResult, timestamp: string): RuntimeResult {
  return {
    projects: result.projects,
    narratives: result.narratives,
    evidence: result.evidence,
    knowledgeGraph: result.knowledgeGraph,
    report: result.report,
    summary: buildSummary(result),
    timestamp,
  };
}

/** Compose the dashboard projection of a runtime result. */
export function composeDashboard(result: PipelineResult, timestamp: string): RuntimeDashboard {
  return {
    projects: result.projects,
    narratives: result.narratives,
    report: result.report,
    knowledgeGraph: result.knowledgeGraph,
    summary: buildSummary(result),
    timestamp,
  };
}
