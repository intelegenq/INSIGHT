import type { Evidence, Narrative, Project, Report, ReportLens } from "@insight/core";
import { projectRepository } from "@insight/data";
import type { ProjectRepository } from "@insight/data";
import {
  DEFAULT_BOUNDS,
  deriveNarratives,
  generateReport,
  scoreProjects,
} from "@insight/intelligence";
import type { Bounds } from "@insight/intelligence";
import { buildKnowledgeGraph } from "@insight/knowledge";
import type { KnowledgeGraph } from "@insight/knowledge";

/**
 * Pipeline — defines the execution order of a runtime run.
 *
 * This module only sequences existing capabilities:
 *   1. Load demo repository (data layer)
 *   2. Run intelligence engine (scoring + narratives + report)
 *   3. Build knowledge graph (knowledge layer)
 *
 * It contains no new business logic.
 */

/** What a pipeline run needs up front. */
export interface PipelineInput {
  repository: ProjectRepository;
  referenceDate: string;
  lens: ReportLens;
  bounds: Bounds;
}

/** What a pipeline run produces. */
export interface PipelineResult {
  projects: Project[];
  narratives: Narrative[];
  evidence: Evidence[];
  knowledgeGraph: KnowledgeGraph;
  report: Report;
}

/**
 * Run the full analysis pipeline in the canonical order.
 * Deterministic: same inputs always produce the same result.
 */
export function runPipeline(input: PipelineInput): PipelineResult {
  const { repository, referenceDate, lens, bounds } = input;

  // 1. Load demo repository.
  const projects = repository.getProjects();

  // 2. Run intelligence engine.
  const evidence = collectEvidence(repository, projects);
  const evidenceById = indexEvidence(evidence);
  const defaults = { referenceDate, bounds };

  const scored = scoreProjects(projects, evidenceById, defaults);
  const derivedNarratives = deriveNarratives(projects, evidenceById, defaults);
  const narratives = derivedNarratives.map((entry) => entry.narrative);

  const report = generateReport({
    lens,
    projects: scored,
    narratives: derivedNarratives,
    evidenceById,
    defaults,
  });

  // 3. Build knowledge graph.
  const knowledgeGraph = buildKnowledgeGraph({ projects, evidence, narratives });

  return { projects, narratives, evidence, knowledgeGraph, report };
}

/** Collect every evidence record referenced by any project. */
function collectEvidence(repository: ProjectRepository, projects: readonly Project[]): Evidence[] {
  const ids = projects.flatMap((project) => project.evidenceIds);
  return repository.resolveEvidenceIds(ids);
}

/** Index evidence by id for engine lookups. */
function indexEvidence(evidence: readonly Evidence[]): ReadonlyMap<string, Evidence> {
  return new Map(evidence.map((item) => [item.id, item]));
}

/** Default pipeline input for the demo repository. */
export function defaultPipelineInput(
  referenceDate: string,
  lens: ReportLens = "ecosystem",
): PipelineInput {
  return {
    repository: projectRepository,
    referenceDate,
    lens,
    bounds: DEFAULT_BOUNDS,
  };
}
