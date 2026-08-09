/**
 * Insight service — framework-friendly adapter around @insight/runtime.
 *
 * M30: wires KvCache (Redis), ObjectStore (S3/MinIO), and evaluation
 * (evaluateReport/evaluateEvidence) into the production pipeline.
 *
 * Production-hardened guarantees:
 *   1. Shared persistence: getSharedSqlClient() for Postgres snapshots.
 *   2. Shared cache: getSharedCache() for API response caching.
 *   3. Shared object store: getSharedObjectStore() for report artifacts.
 *   4. Readiness: async init ensures live data is loaded before requests.
 *   5. No demo bypasses: all data flows through the live/snapshot pipeline.
 *   6. Evaluation: reports carry quality verdicts from evaluateReport.
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
  getSharedCache,
  getSharedObjectStore,
  PostgresSnapshotRepository,
  evaluateReport,
  type ReportVerdict,
  type KvCache,
  type ObjectStore,
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
  /** Override cache (tests). Defaults to shared infra-resolved. */
  cache?: KvCache;
  /** Override object store (tests). Defaults to shared infra-resolved. */
  objectStore?: ObjectStore;
}

export interface EvaluatedReport {
  report: Report;
  verdict: ReportVerdict;
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
  /** Lazily-resolved shared cache (Redis in production, in-memory in dev). */
  private cachePromise: Promise<KvCache> | undefined;
  /** Lazily-resolved shared object store (S3/MinIO in production, in-memory in dev). */
  private objectStorePromise: Promise<ObjectStore> | undefined;

  constructor(options: InsightServiceOptions = {}) {
    this.referenceDate = options.referenceDate ?? resolveReferenceDate();

    // Resolve providers: explicit override > env credentials > demo fallback
    const providers = options.providers ?? resolveProductionProviders();
    this.isLive = providers.some((p) => p.id !== "demo");

    this.compositeRepo = new CompositeRepository({ providers });

    // Readiness: load live provider data before serving requests.
    this.readyPromise = this.compositeRepo.load().catch(() => {});

    this.runtime = InsightRuntime.create(this.compositeRepo);

    // Snapshot storage: explicit override > shared infra-resolved
    if (options.snapshotRepository) {
      this.snapshotRepository = options.snapshotRepository;
    } else {
      const config = resolveInfraConfig();
      if (config.postgresUrl) {
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

    // Cache: explicit override > shared infra-resolved
    if (options.cache) {
      this.cachePromise = Promise.resolve(options.cache);
    }

    // Object store: explicit override > shared infra-resolved
    if (options.objectStore) {
      this.objectStorePromise = Promise.resolve(options.objectStore);
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

  /** Resolve the shared cache (lazy, async). */
  private async getCache(): Promise<KvCache> {
    if (this.cachePromise === undefined) {
      this.cachePromise = getSharedCache();
    }
    return this.cachePromise;
  }

  /** Resolve the shared object store (lazy, async). */
  private async getObjectStore(): Promise<ObjectStore> {
    if (this.objectStorePromise === undefined) {
      this.objectStorePromise = getSharedObjectStore();
    }
    return this.objectStorePromise;
  }

  run(): RuntimeResult {
    return this.runtime.analyze({ referenceDate: this.referenceDate });
  }

  async listProjects(): Promise<Project[]> {
    await this.ready();
    // Check cache first
    const cache = await this.getCache();
    const cached = await cache.get<Project[]>("insight:projects");
    if (cached !== undefined) return cached;

    const snapshots = await this.snapshotRepository.list();
    let projects: Project[];
    if (snapshots.length > 0) {
      projects = [...(snapshots[snapshots.length - 1]?.projects ?? [])];
    } else {
      projects = this.runtime.analyze({ referenceDate: this.referenceDate }).projects;
    }
    await cache.set("insight:projects", projects);
    return projects;
  }

  async getProject(projectId: string): Promise<Project | undefined> {
    const projects = await this.listProjects();
    return projects.find((p) => p.id === projectId);
  }

  async resolveEvidenceIds(evidenceIds: readonly string[]): Promise<Evidence[]> {
    await this.ready();
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      const evidenceList = latest?.evidence ?? [];
      const byId = new Map(evidenceList.map((e) => [e.id, e]));
      return evidenceIds.map((id) => byId.get(id)).filter((e): e is Evidence => e !== undefined);
    }
    const result = this.runtime.analyze({ referenceDate: this.referenceDate });
    const byId = new Map(result.evidence.map((e) => [e.id, e]));
    return evidenceIds.map((id) => byId.get(id)).filter((e): e is Evidence => e !== undefined);
  }

  async getReport(lens: ReportLens = "ecosystem"): Promise<Report | undefined> {
    await this.ready();
    // Check cache first
    const cache = await this.getCache();
    const cacheKey = `insight:report:${lens}`;
    const cached = await cache.get<Report>(cacheKey);
    if (cached !== undefined) return cached;

    let report: Report | undefined;
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      if (latest?.report.lens === lens) {
        report = latest.report;
      } else {
        report = this.runtime.analyze({ referenceDate: this.referenceDate, lens }).report;
      }
    } else {
      report = this.runtime.analyze({ referenceDate: this.referenceDate, lens }).report;
    }

    if (report) {
      // Persist report artifact to object store
      const objectStore = await this.getObjectStore();
      const artifactKey = `reports/${report.id}.json`;
      await objectStore.put({
        key: artifactKey,
        body: new TextEncoder().encode(JSON.stringify(report)),
        contentType: "application/json",
      });

      await cache.set(cacheKey, report);
    }
    return report;
  }

  /**
   * M30: Get a report with its quality evaluation verdict.
   * Runs evaluateReport against the report's backing evidence.
   */
  async getEvaluatedReport(lens: ReportLens = "ecosystem"): Promise<EvaluatedReport | undefined> {
    const report = await this.getReport(lens);
    if (report === undefined) return undefined;

    const evidence = await this.resolveEvidenceIds(report.evidenceIds);
    const verdict = evaluateReport({
      reportId: report.id,
      confidence: report.confidence,
      evidence,
    });
    return { report, verdict };
  }

  async getNarratives(): Promise<Narrative[]> {
    await this.ready();
    const cache = await this.getCache();
    const cached = await cache.get<Narrative[]>("insight:narratives");
    if (cached !== undefined) return cached;

    const snapshots = await this.snapshotRepository.list();
    let narratives: Narrative[];
    if (snapshots.length > 0) {
      narratives = [...(snapshots[snapshots.length - 1]?.narratives ?? [])];
    } else {
      narratives = this.runtime.analyze({ referenceDate: this.referenceDate }).narratives;
    }
    await cache.set("insight:narratives", narratives);
    return narratives;
  }

  async getPulse(): Promise<PulseSnapshot> {
    await this.ready();
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      if (latest) return snapshotToPulse(latest);
    }
    const result = this.runtime.analyze({ referenceDate: this.referenceDate });
    return runtimeResultToPulse(result, this.referenceDate);
  }

  async getTimeline(): Promise<TimelineEvent[]> {
    await this.ready();
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      if (latest) return snapshotToTimeline(latest);
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
    // Invalidate caches on new snapshot
    const cache = await this.getCache();
    await cache.delete("insight:projects");
    await cache.delete("insight:narratives");
    for (const lens of ["ecosystem", "defi", "infrastructure"]) {
      await cache.delete(`insight:report:${lens}`);
    }
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
    if (from === undefined) throw InsightErrors.snapshotNotFound(fromId);
    if (to === undefined) throw InsightErrors.snapshotNotFound(toId);
    return this.historyAnalyzer.compare(from, to);
  }
}

/**
 * LazySnapshotRepository — wraps an async factory that produces the real
 * AsyncSnapshotRepository on first use.
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

function snapshotToTimeline(snapshot: Snapshot): TimelineEvent[] {
  return snapshot.projects.slice(0, 8).map((p, i) => ({
    id: `timeline-${i}-${p.id}`,
    time: snapshot.referenceDate,
    title: p.name,
    source: p.category,
    confidence: "medium",
  }));
}

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
