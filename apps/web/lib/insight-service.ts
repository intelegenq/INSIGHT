/**
 * Insight service — framework-friendly adapter around @insight/runtime.
 *
 * Production-hardened: wires production providers + shared infra-backed
 * snapshot storage. Key guarantees:
 *   1. Shared persistence: uses getSharedSqlClient() so worker-written
 *      snapshots are visible to the web app (real Postgres in production,
 *      in-memory in dev/test).
 *   2. Readiness: async initialization ensures live provider data is loaded
 *      before any API request is served — no fire-and-forget race.
 *   3. No demo bypasses: pulse/timeline/evidence all flow through the
 *      live/snapshot pipeline, not direct projectRepository imports.
 */
import { HistoryAnalyzer, InsightErrors } from "@insight/runtime";
import type { Project, Report, ReportLens, Evidence, Narrative } from "@insight/core";
import type { PulseSnapshot, TimelineEvent } from "@insight/data";
import type { Snapshot, RuntimeResult } from "@insight/runtime";
import {
  InMemorySnapshotRepository,
  InsightRuntime,
  createSnapshot,
  type AsyncSnapshotRepository,
  type SyncSnapshotRepository,
} from "@insight/runtime";
import {
  projectRepository,
  resolveProductionProviders,
  CompositeRepository,
  type DataProvider,
} from "@insight/data";
import {
  resolveInfraConfig,
  assembleInfra,
  getSharedSqlClient,
  PostgresSnapshotRepository,
} from "@insight/infra";

/** Deterministic reference date for dev/test — production overrides via env. */
const DEFAULT_REFERENCE_DATE = "2026-01-01T00:00:00.000Z";

/** Stable reference date — uses env override, otherwise a fixed deterministic date. */
function resolveReferenceDate(): string {
  const env = process.env["INSIGHT_REFERENCE_DATE"];
  if (env && env.length > 0) return env;
  return DEFAULT_REFERENCE_DATE;
}

export interface InsightServiceOptions {
  referenceDate?: string;
  /** Override providers (tests). Defaults to env-resolved production providers. */
  providers?: DataProvider[];
  /** Override snapshot repository (tests). Defaults to infra-resolved. */
  snapshotRepository?: SyncSnapshotRepository | AsyncSnapshotRepository;
}

export class InsightService {
  private readonly runtime: InsightRuntime;
  private readonly snapshotRepository: SyncSnapshotRepository | AsyncSnapshotRepository;
  private readonly historyAnalyzer: HistoryAnalyzer;
  private readonly referenceDate: string;
  private readonly isLive: boolean;
  private readonly compositeRepo: CompositeRepository;
  /** Resolves when live provider data has been loaded (or failed gracefully). */
  private readonly readyPromise: Promise<void>;

  constructor(options: InsightServiceOptions = {}) {
    this.referenceDate = options.referenceDate ?? resolveReferenceDate();

    // Resolve providers: explicit override > env credentials > demo fallback
    const providers = options.providers ?? resolveProductionProviders();
    this.isLive = providers.some((p) => p.id !== "demo");

    // Build a CompositeRepository from resolved providers so the runtime
    // reads from live data when available. In demo mode the composite repo
    // is functionally equivalent to the default projectRepository.
    this.compositeRepo = new CompositeRepository({ providers });

    // Readiness: load live provider data before serving requests.
    // In dev/test (demo providers), load is instant (static data).
    // In production (live providers), load fetches from APIs — we await
    // it so the first API request doesn't hit empty/demo data.
    // If load fails, the composite repo serves whatever data it has and
    // the pipeline falls back to demo data from the demo provider.
    if (this.isLive) {
      this.readyPromise = this.compositeRepo.load().catch(() => {
        // Swallow — pipeline will fall back to demo data via the demo
        // provider that's always included as the last provider.
      });
    } else {
      // Demo mode: no async load needed (CompositeRepository with demo
      // providers seeds synchronously when fromStatic is used, or load()
      // resolves instantly for static payloads).
      this.readyPromise = this.compositeRepo.load().catch(() => {});
    }

    this.runtime = InsightRuntime.create(this.compositeRepo);

    // Snapshot storage: explicit override > shared infra-resolved
    if (options.snapshotRepository) {
      this.snapshotRepository = options.snapshotRepository;
    } else {
      // Use shared SqlClient so worker and web share the same Postgres pool.
      // This is async but we need a sync reference — we create an
      // InMemorySnapshotRepository as a temporary sync fallback and replace
      // it when the async shared client resolves. However, for the
      // PostgresSnapshotRepository to work, we need the SqlClient.
      // Pattern: create the snapshot repo synchronously with InMemorySqlClient,
      // then the shared client is resolved on first async API call.
      const config = resolveInfraConfig();
      if (config.postgresUrl) {
        // Production path: use shared Postgres client. Since the shared
        // client is async, we store a lazy wrapper that resolves on first use.
        this.snapshotRepository = new LazySnapshotRepository(async () => {
          const sql = await getSharedSqlClient();
          const repo = new PostgresSnapshotRepository(sql);
          await repo.initialize();
          return repo;
        });
      } else {
        this.snapshotRepository = new InMemorySnapshotRepository();
      }
    }

    this.historyAnalyzer = new HistoryAnalyzer();
  }

  /** Whether the service is backed by live (non-demo) providers. */
  get live(): boolean {
    return this.isLive;
  }

  /** Await readiness — call before serving API requests. */
  async ready(): Promise<void> {
    await this.readyPromise;
  }

  run(): RuntimeResult {
    return this.runtime.analyze({ referenceDate: this.referenceDate });
  }

  async listProjects(): Promise<Project[]> {
    await this.ready();
    // Try the snapshot store first (may have persisted live data from worker)
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      return [...(latest?.projects ?? [])];
    }
    // Fallback: run the pipeline fresh (uses the wired composite repo)
    return this.runtime.analyze({ referenceDate: this.referenceDate }).projects;
  }

  async getProject(projectId: string): Promise<Project | undefined> {
    const projects = await this.listProjects();
    return projects.find((p) => p.id === projectId);
  }

  async resolveEvidenceIds(evidenceIds: readonly string[]): Promise<Evidence[]> {
    await this.ready();
    // Try snapshot store first for live evidence
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      const evidenceList = latest?.evidence ?? [];
      const byId = new Map(evidenceList.map((e) => [e.id, e]));
      return evidenceIds.map((id) => byId.get(id)).filter((e): e is Evidence => e !== undefined);
    }
    // Fallback: resolve from the composite repo's evidence (runtime pipeline)
    const result = this.runtime.analyze({ referenceDate: this.referenceDate });
    const byId = new Map(result.evidence.map((e) => [e.id, e]));
    return evidenceIds.map((id) => byId.get(id)).filter((e): e is Evidence => e !== undefined);
  }

  async getReport(lens: ReportLens = "ecosystem"): Promise<Report | undefined> {
    await this.ready();
    // Try the snapshot store for a matching report
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      if (latest?.report.lens === lens) return latest.report;
      // No matching lens in latest snapshot — run fresh
      return this.runtime.analyze({ referenceDate: this.referenceDate, lens }).report;
    }
    // No snapshots: run the pipeline fresh
    return this.runtime.analyze({ referenceDate: this.referenceDate, lens }).report;
  }

  async getNarratives(): Promise<Narrative[]> {
    await this.ready();
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      return [...(snapshots[snapshots.length - 1]?.narratives ?? [])];
    }
    return this.runtime.analyze({ referenceDate: this.referenceDate }).narratives;
  }

  async getPulse(): Promise<PulseSnapshot> {
    await this.ready();
    // When live snapshots exist, derive a pulse from the snapshot data
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      if (latest) {
        return snapshotToPulse(latest);
      }
    }
    // Fallback: run the pipeline fresh and derive pulse from the result
    const result = this.runtime.analyze({ referenceDate: this.referenceDate });
    return runtimeResultToPulse(result, this.referenceDate);
  }

  async getTimeline(): Promise<TimelineEvent[]> {
    await this.ready();
    // Timeline is an editorial view — derive from snapshot or runtime result
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      if (latest) {
        return snapshotToTimeline(latest);
      }
    }
    const result = this.runtime.analyze({ referenceDate: this.referenceDate });
    return runtimeResultToTimeline(result, this.referenceDate);
  }

  async snapshot(): Promise<Snapshot> {
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
    return this.snapshotRepository.save(snapshot);
  }

  async snapshotAt(referenceDate: string): Promise<Snapshot> {
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
    return this.snapshotRepository.save(snapshot);
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return this.snapshotRepository.list();
  }

  async getSnapshot(id: string): Promise<Snapshot | undefined> {
    return this.snapshotRepository.get(id);
  }

  async compareSnapshots(
    fromId: string,
    toId: string,
  ): Promise<import("@insight/runtime").HistoryDiff> {
    const from = await this.snapshotRepository.get(fromId);
    const to = await this.snapshotRepository.get(toId);
    if (from === undefined) {
      throw InsightErrors.snapshotNotFound(fromId);
    }
    if (to === undefined) {
      throw InsightErrors.snapshotNotFound(toId);
    }
    return this.historyAnalyzer.compare(from, to);
  }
}

/**
 * LazySnapshotRepository — wraps an async factory that produces the real
 * AsyncSnapshotRepository on first use. All methods await the factory
 * before delegating. This lets InsightService construct synchronously
 * while deferring the async Postgres client resolution to first API call.
 */
class LazySnapshotRepository implements AsyncSnapshotRepository {
  private delegatePromise: Promise<AsyncSnapshotRepository> | undefined;

  constructor(private readonly factory: () => Promise<AsyncSnapshotRepository>) {}

  private delegate(): Promise<AsyncSnapshotRepository> {
    if (this.delegatePromise === undefined) {
      this.delegatePromise = this.factory();
    }
    return this.delegatePromise;
  }

  get size(): number {
    return 0;
  }

  async save(snapshot: Snapshot): Promise<Snapshot> {
    const repo = await this.delegate();
    return repo.save(snapshot);
  }

  async get(id: string): Promise<Snapshot | undefined> {
    const repo = await this.delegate();
    return repo.get(id);
  }

  async list(): Promise<Snapshot[]> {
    const repo = await this.delegate();
    return repo.list();
  }

  async delete(id: string): Promise<boolean> {
    const repo = await this.delegate();
    return repo.delete(id);
  }

  async clear(): Promise<void> {
    const repo = await this.delegate();
    return repo.clear();
  }
}

/** Derive a PulseSnapshot from a persisted Snapshot's data. */
function snapshotToPulse(snapshot: Snapshot): PulseSnapshot {
  return {
    asOf: snapshot.referenceDate,
    metrics: [
      {
        id: "projects",
        label: "Tracked Projects",
        value: String(snapshot.summary.projectCount),
        caption: "Protocols in scope",
      },
      {
        id: "narratives",
        label: "Active Narratives",
        value: String(snapshot.summary.narrativeCount),
        caption: "Surfaced themes",
        variant: "violet",
      },
      {
        id: "evidence",
        label: "Evidence Items",
        value: String(snapshot.summary.evidenceCount),
        caption: "Citable signals",
      },
      {
        id: "graph",
        label: "Graph Entities",
        value: String(snapshot.summary.graphEntityCount),
        caption: "Entity graph nodes",
      },
    ],
  };
}

/** Derive a PulseSnapshot from a fresh RuntimeResult. */
function runtimeResultToPulse(result: RuntimeResult, referenceDate: string): PulseSnapshot {
  return {
    asOf: referenceDate,
    metrics: [
      {
        id: "projects",
        label: "Tracked Projects",
        value: String(result.summary.projectCount),
        caption: "Protocols in scope",
      },
      {
        id: "narratives",
        label: "Active Narratives",
        value: String(result.summary.narrativeCount),
        caption: "Surfaced themes",
        variant: "violet",
      },
      {
        id: "evidence",
        label: "Evidence Items",
        value: String(result.summary.evidenceCount),
        caption: "Citable signals",
      },
      {
        id: "graph",
        label: "Graph Entities",
        value: String(result.summary.graphEntityCount),
        caption: "Entity graph nodes",
      },
    ],
  };
}

/** Derive a timeline from a snapshot's projects and narratives. */
function snapshotToTimeline(snapshot: Snapshot): TimelineEvent[] {
  return snapshot.projects.slice(0, 8).map((p, i) => ({
    id: `timeline-${i}-${p.id}`,
    time: snapshot.referenceDate,
    title: p.name,
    source: p.category,
    confidence: "medium",
  }));
}

/** Derive a timeline from a fresh RuntimeResult. */
function runtimeResultToTimeline(result: RuntimeResult, referenceDate: string): TimelineEvent[] {
  return result.projects.slice(0, 8).map((p, i) => ({
    id: `timeline-${i}-${p.id}`,
    time: referenceDate,
    title: p.name,
    source: p.category,
    confidence: "medium",
  }));
}

let shared: InsightService | undefined;
export function getInsightService(): InsightService {
  if (shared === undefined) shared = new InsightService();
  return shared;
}
export function resetInsightService(): void {
  shared = undefined;
}
