/**
 * Insight service — framework-friendly adapter around `@insight/runtime`.
 *
 * This module owns a single {@link import("@insight/runtime").runtime}
 * instance and a single {@link import("@insight/runtime").InMemorySnapshotRepository}
 * instance per process. It is the *only* place the web app talks to the
 * runtime package, so the runtime stays framework-independent.
 *
 * For deterministic outputs in serverless contexts, every method accepts an
 * explicit `referenceDate` (ISO-8601) and uses the supplied value as the
 * snapshot timestamp. When omitted, the runtime's own default (zero) applies.
 */

import { HistoryAnalyzer } from "@insight/runtime";
import type {
  Project,
  Report,
} from "@insight/core";
import type { Snapshot, RuntimeResult } from "@insight/runtime";
import {
  InMemorySnapshotRepository,
  InsightRuntime,
  createSnapshot,
} from "@insight/runtime";
import { projectRepository } from "@insight/data";

const DEFAULT_REFERENCE_DATE = "2026-01-01T00:00:00.000Z";

export interface InsightServiceOptions {
  referenceDate?: string;
}

export class InsightService {
  private readonly runtime: InsightRuntime;
  private readonly repository: InMemorySnapshotRepository;
  private readonly historyAnalyzer: HistoryAnalyzer;
  private readonly referenceDate: string;

  constructor(options: InsightServiceOptions = {}) {
    this.runtime = InsightRuntime.create();
    this.repository = new InMemorySnapshotRepository();
    this.historyAnalyzer = new HistoryAnalyzer();
    this.referenceDate = options.referenceDate ?? DEFAULT_REFERENCE_DATE;
  }

  /** Run the runtime pipeline with the service's reference date. */
  run(): RuntimeResult {
    return this.runtime.analyze({ referenceDate: this.referenceDate });
  }

  /** Fetch the current list of projects. */
  listProjects(): Project[] {
    const snapshots = this.repository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      return latest ? [...latest.projects] : [];
    }
    return projectRepository.getProjects();
  }

  /** Fetch the current generated report. */
  getReport(): Report | undefined {
    if (this.repository.size > 0) {
      const snapshots = this.repository.list();
      return snapshots[snapshots.length - 1]?.report;
    }
    return projectRepository.getReport("ecosystem");
  }

  /** Persist a snapshot of the current pipeline result. */
  snapshot(): Snapshot {
    const result = this.run();
    const snapshot = createSnapshot({
      referenceDate: this.referenceDate,
      options: { referenceDate: this.referenceDate },
      summary: result.summary,
      projects: result.projects,
      narratives: result.narratives,
      evidence: result.evidence,
      report: result.report,
      knowledgeGraph: result.knowledgeGraph,
    });
    return this.repository.save(snapshot);
  }

  /**
   * Persist a snapshot with an explicit reference date (ISO-8601). Useful for
   * tests and admin tooling that need to seed history with distinct points.
   */
  snapshotAt(referenceDate: string): Snapshot {
    const result = this.runtime.analyze({ referenceDate });
    const snapshot = createSnapshot({
      referenceDate,
      options: { referenceDate },
      summary: result.summary,
      projects: result.projects,
      narratives: result.narratives,
      evidence: result.evidence,
      report: result.report,
      knowledgeGraph: result.knowledgeGraph,
    });
    return this.repository.save(snapshot);
  }

  /** List stored snapshots in insertion order. */
  listSnapshots(): Snapshot[] {
    return this.repository.list();
  }

  /** Retrieve a snapshot by id. */
  getSnapshot(id: string): Snapshot | undefined {
    return this.repository.get(id);
  }

  /** Compare two snapshots by id and return a deterministic history diff. */
  compareSnapshots(fromId: string, toId: string): import("@insight/runtime").HistoryDiff | undefined {
    const from = this.repository.get(fromId);
    const to = this.repository.get(toId);
    if (from === undefined || to === undefined) {
      return undefined;
    }
    return this.historyAnalyzer.compare(from, to);
  }
}

/**
 * Shared service instance. Next.js may re-import this module per serverless
 * invocation; the in-memory repository will reset, but the runtime
 * contracts stay deterministic.
 */
let shared: InsightService | undefined;

export function getInsightService(): InsightService {
  if (shared === undefined) {
    shared = new InsightService();
  }
  return shared;
}

/** Reset the shared instance (used by tests). */
export function resetInsightService(): void {
  shared = undefined;
}