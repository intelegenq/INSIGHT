import type { Evidence, Narrative, Project, Report, ReportLens } from "@insight/core";
import { projectRepository } from "@insight/data";
import type { ProjectRepository } from "@insight/data";
import { DEFAULT_BOUNDS } from "@insight/intelligence";
import type { Bounds } from "@insight/intelligence";
import { buildKnowledgeGraph } from "@insight/knowledge";
import type { KnowledgeGraph } from "@insight/knowledge";

import { runPipeline } from "./pipeline";
import type { PipelineInput, PipelineResult } from "./pipeline";
import { composeDashboard, composeRuntimeResult } from "./report";
import type { RuntimeDashboard, RuntimeOptions, RuntimeResult } from "./types";

/**
 * InsightRuntime — the deterministic orchestration layer for Insight.
 *
 * Thin by design: it wires the data repository, intelligence engines, and
 * knowledge graph together, then composes results. All business logic lives
 * in @insight/intelligence; all graph logic lives in @insight/knowledge.
 *
 * Every public method is deterministic: results depend only on the options
 * passed in (reference timestamp included), never on wall-clock time.
 */
export class InsightRuntime {
  private readonly repository: ProjectRepository;

  private constructor(repository: ProjectRepository) {
    this.repository = repository;
  }

  /**
   * Create a runtime instance.
   * @param repository repository to read data from; defaults to the demo repository.
   */
  static create(repository: ProjectRepository = projectRepository): InsightRuntime {
    return new InsightRuntime(repository);
  }

  /** Build pipeline input from options, resolving defaults. */
  private buildInput(options: RuntimeOptions): PipelineInput {
    return {
      repository: options.repository ?? this.repository,
      referenceDate: options.referenceDate,
      lens: options.lens ?? "ecosystem",
      bounds: options.bounds ?? DEFAULT_BOUNDS,
    };
  }

  /**
   * Run the full analysis pipeline.
   * Returns the complete runtime result (projects, narratives, evidence,
   * knowledge graph, report, summary).
   */
  analyze(options: RuntimeOptions): RuntimeResult {
    const input = this.buildInput(options);
    const result = runPipeline(input);
    return composeRuntimeResult(result, options.referenceDate);
  }

  /** Run the pipeline and return only the knowledge graph. */
  buildKnowledgeGraph(options: RuntimeOptions): KnowledgeGraph {
    const input = this.buildInput(options);
    return runPipeline(input).knowledgeGraph;
  }

  /** Run the pipeline and return only the generated report. */
  generateReport(options: RuntimeOptions): Report {
    const input = this.buildInput(options);
    return runPipeline(input).report;
  }

  /** Run the pipeline and return the dashboard projection. */
  generateDashboard(options: RuntimeOptions): RuntimeDashboard {
    const input = this.buildInput(options);
    const result = runPipeline(input);
    return composeDashboard(result, options.referenceDate);
  }

  /** Run the pipeline and return the snapshot (same contract as analyze). */
  generateSnapshot(options: RuntimeOptions): RuntimeResult {
    return this.analyze(options);
  }

  /** Convenience accessor: run the pipeline and return the projects. */
  getProjects(options: RuntimeOptions): Project[] {
    const input = this.buildInput(options);
    return runPipeline(input).projects;
  }

  /** Convenience accessor: run the pipeline and return the narratives. */
  getNarratives(options: RuntimeOptions): Narrative[] {
    const input = this.buildInput(options);
    return runPipeline(input).narratives;
  }

  /** Convenience accessor: run the pipeline and return the evidence. */
  getEvidence(options: RuntimeOptions): Evidence[] {
    const input = this.buildInput(options);
    return runPipeline(input).evidence;
  }

  /** Convenience accessor: run the pipeline and return the lens-adjusted report. */
  generateReportForLens(options: RuntimeOptions, lens: ReportLens): Report {
    return this.generateReport({ ...options, lens });
  }
}

/** Convenience: a shared runtime instance over the demo repository. */
export const runtime = InsightRuntime.create();
