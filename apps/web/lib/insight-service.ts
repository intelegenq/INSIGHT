/**
 * Insight service — framework-friendly adapter around @insight/runtime.
 */
import { HistoryAnalyzer } from "@insight/runtime";
import type { Project, Report, ReportLens } from "@insight/core";
import type { Snapshot, RuntimeResult } from "@insight/runtime";
import {
  InMemorySnapshotRepository,
  InsightRuntime,
  createSnapshot,
  InsightErrors,
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

  run(): RuntimeResult {
    return this.runtime.analyze({ referenceDate: this.referenceDate });
  }

  listProjects(): Project[] {
    const snapshots = this.repository.list();
    if (snapshots.length > 0) return [...(snapshots[snapshots.length - 1]?.projects ?? [])];
    return projectRepository.getProjects();
  }

  getReport(lens: ReportLens = "ecosystem"): Report | undefined {
    if (this.repository.size > 0) {
      const snapshots = this.repository.list();
      const latest = snapshots[snapshots.length - 1];
      if (latest?.report.lens === lens) return latest.report;
      return undefined;
    }
    return projectRepository.getReport(lens);
  }

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

  listSnapshots(): Snapshot[] {
    return this.repository.list();
  }
  getSnapshot(id: string): Snapshot | undefined {
    return this.repository.get(id);
  }

  compareSnapshots(
    fromId: string,
    toId: string,
  ): import("@insight/runtime").HistoryDiff | undefined {
    const from = this.repository.get(fromId);
    const to = this.repository.get(toId);
    if (from === undefined) throw InsightErrors.snapshotNotFound(fromId);
    if (to === undefined) throw InsightErrors.snapshotNotFound(toId);
    return this.historyAnalyzer.compare(from, to);
  }
}

let shared: InsightService | undefined;
export function getInsightService(): InsightService {
  if (shared === undefined) shared = new InsightService();
  return shared;
}
export function resetInsightService(): void {
  shared = undefined;
}
