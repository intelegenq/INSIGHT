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

/** M39: Uniform shape for cross-project comparison. */
export interface ComparisonEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  metrics: import("@insight/core").ProjectMetrics;
  health?: import("@insight/intelligence").ProjectHealth;
  evidenceCount: number;
}

/** M43: A single data point in a project's trend across snapshots. */
export interface ProjectTrendPoint {
  snapshotId: string;
  referenceDate: string;
  metrics: import("@insight/core").ProjectMetrics;
  health: import("@insight/intelligence").ProjectHealth;
}

export class InsightService {
  private readonly runtime: InsightRuntime;
  private readonly snapshotRepository: SyncSnapshotRepository | AsyncSnapshotRepository;
  private readonly historyAnalyzer: HistoryAnalyzer;
  private readonly referenceDate: string;
  private readonly isLive: boolean;
  private readonly compositeRepo: CompositeRepository;
  private readonly providers: DataProvider[];
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
    this.providers = providers;

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

  /**
   * M37: Get project health scores (health, momentum, risk, developer).
   * Uses the existing scoreProject from @insight/intelligence.
   */
  async getProjectHealth(
    projectId: string,
  ): Promise<import("@insight/intelligence").ProjectHealth | undefined> {
    const project = await this.getProject(projectId);
    if (project === undefined) return undefined;
    const evidence = await this.resolveEvidenceIds(project.evidenceIds);
    const { scoreProject, DEFAULT_BOUNDS } = await import("@insight/intelligence");
    return scoreProject(project, evidence, {
      referenceDate: this.referenceDate,
      bounds: DEFAULT_BOUNDS,
    });
  }

  /**
   * M39: Compare multiple projects side by side.
   *
   * Returns each project's metrics, health scores, and evidence count
   * in a uniform shape suitable for a comparison table. Uses existing
   * listProjects, getProjectHealth, and resolveEvidenceIds — no new data.
   */
  async compareProjects(projectIds: readonly string[]): Promise<ComparisonEntry[]> {
    await this.ready();
    const allProjects = await this.listProjects();
    const byId = new Map(allProjects.map((p) => [p.id, p]));
    const entries: ComparisonEntry[] = [];
    for (const id of projectIds) {
      const project = byId.get(id);
      if (project === undefined) continue;
      const health = await this.getProjectHealth(id);
      const evidence = await this.resolveEvidenceIds(project.evidenceIds);
      entries.push({
        id: project.id,
        name: project.name,
        category: project.category,
        description: project.description,
        metrics: project.metrics,
        health,
        evidenceCount: evidence.length,
      });
    }
    return entries;
  }

  /**
   * M43: Get a project's trend across all snapshots.
   *
   * Walks every snapshot chronologically, finds the project in each, and
   * computes its metrics and health scores at that point in time. Uses
   * existing listSnapshots, scoreProject, and snapshot evidence — no new
   * data, no AI.
   */
  async getProjectTrend(projectId: string): Promise<ProjectTrendPoint[]> {
    await this.ready();
    const snapshots = await this.snapshotRepository.list();
    // Sort chronologically
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.referenceDate).getTime() - new Date(b.referenceDate).getTime(),
    );
    const points: ProjectTrendPoint[] = [];
    for (const snap of sorted) {
      const project = snap.projects.find((p) => p.id === projectId);
      if (project === undefined) continue;
      const evidence = project.evidenceIds
        .map((id) => snap.evidence.find((e) => e.id === id))
        .filter((e): e is Evidence => e !== undefined);
      const { scoreProject, DEFAULT_BOUNDS } = await import("@insight/intelligence");
      const health = scoreProject(project, evidence, {
        referenceDate: snap.referenceDate,
        bounds: DEFAULT_BOUNDS,
      });
      points.push({
        snapshotId: snap.id,
        referenceDate: snap.referenceDate,
        metrics: { ...project.metrics },
        health,
      });
    }
    return points;
  }

  /**
   * M45: Get trend data for multiple projects simultaneously for overlay comparison.
   * Returns a map of projectId → ProjectTrendPoint[] sorted chronologically.
   */
  async getMultiProjectTrend(
    projectIds: readonly string[],
  ): Promise<Record<string, { name: string; points: ProjectTrendPoint[] }>> {
    await this.ready();
    const snapshots = await this.snapshotRepository.list();
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.referenceDate).getTime() - new Date(b.referenceDate).getTime(),
    );
    const projects = await this.listProjects();
    const result: Record<string, { name: string; points: ProjectTrendPoint[] }> = {};

    for (const pid of projectIds) {
      const projectInfo = projects.find((p) => p.id === pid);
      result[pid] = {
        name: projectInfo?.name ?? pid,
        points: [],
      };
    }

    for (const snap of sorted) {
      for (const pid of projectIds) {
        const project = snap.projects.find((p) => p.id === pid);
        if (project === undefined) continue;
        const evidence = project.evidenceIds
          .map((id) => snap.evidence.find((e) => e.id === id))
          .filter((e): e is Evidence => e !== undefined);
        const { scoreProject, DEFAULT_BOUNDS } = await import("@insight/intelligence");
        const health = scoreProject(project, evidence, {
          referenceDate: snap.referenceDate,
          bounds: DEFAULT_BOUNDS,
        });
        result[pid]!.points.push({
          snapshotId: snap.id,
          referenceDate: snap.referenceDate,
          metrics: { ...project.metrics },
          health,
        });
      }
    }
    return result;
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

  /**
   * M34: Get the knowledge graph from the latest snapshot or live runtime.
   * Surfaces the existing knowledge graph that was previously built but
   * never exposed through the API/UI.
   */
  async getKnowledgeGraph(): Promise<import("@insight/knowledge").KnowledgeGraph> {
    await this.ready();
    const cache = await this.getCache();
    const cached =
      await cache.get<import("@insight/knowledge").KnowledgeGraph>("insight:knowledge-graph");
    if (cached !== undefined) return cached;

    let graph: import("@insight/knowledge").KnowledgeGraph;
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      graph =
        latest?.knowledgeGraph ??
        this.runtime.analyze({ referenceDate: this.referenceDate }).knowledgeGraph;
    } else {
      graph = this.runtime.analyze({ referenceDate: this.referenceDate }).knowledgeGraph;
    }
    await cache.set("insight:knowledge-graph", graph);
    return graph;
  }

  /**
   * M46: Get all evidence from all snapshots sorted chronologically by observedAt.
   * Deduplicates evidence by ID across snapshots. Returns evidence with project
   * and narrative associations where available.
   */
  async getEvidenceTimeline(filter?: {
    status?: string;
    sourceId?: string;
    projectId?: string;
  }): Promise<
    Array<
      {
        evidence: Evidence;
        projectIds: string[];
        narrativeIds: string[];
      } & { snapshotId: string }
    >
  > {
    await this.ready();
    const snapshots = await this.snapshotRepository.list();
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.referenceDate).getTime() - new Date(b.referenceDate).getTime(),
    );

    // Collect evidence with project/narrative associations, dedup by evidence ID
    const evidenceMap = new Map<
      string,
      { evidence: Evidence; projectIds: Set<string>; narrativeIds: Set<string>; snapshotId: string }
    >();

    for (const snap of sorted) {
      // Build reverse maps: evidence → projects, evidence → narratives
      const evToProjects = new Map<string, string[]>();
      for (const proj of snap.projects) {
        for (const evId of proj.evidenceIds) {
          const arr = evToProjects.get(evId) ?? [];
          arr.push(proj.id);
          evToProjects.set(evId, arr);
        }
      }
      const evToNarratives = new Map<string, string[]>();
      for (const nar of snap.narratives) {
        for (const evId of nar.evidenceIds) {
          const arr = evToNarratives.get(evId) ?? [];
          arr.push(nar.id);
          evToNarratives.set(evId, arr);
        }
      }

      for (const ev of snap.evidence) {
        if (evidenceMap.has(ev.id)) {
          // Merge associations from later snapshots
          const existing = evidenceMap.get(ev.id)!;
          for (const pid of evToProjects.get(ev.id) ?? []) existing.projectIds.add(pid);
          for (const nid of evToNarratives.get(ev.id) ?? []) existing.narrativeIds.add(nid);
          continue;
        }
        evidenceMap.set(ev.id, {
          evidence: ev,
          projectIds: new Set(evToProjects.get(ev.id) ?? []),
          narrativeIds: new Set(evToNarratives.get(ev.id) ?? []),
          snapshotId: snap.id,
        });
      }
    }

    // Convert to array and sort by observedAt
    let result = [...evidenceMap.values()].sort(
      (a, b) =>
        new Date(b.evidence.observedAt).getTime() - new Date(a.evidence.observedAt).getTime(),
    );

    // Apply filters
    if (filter?.status && filter.status !== "all") {
      result = result.filter((r) => r.evidence.status === filter.status);
    }
    if (filter?.sourceId && filter.sourceId !== "all") {
      result = result.filter((r) => r.evidence.source.id === filter.sourceId);
    }
    if (filter?.projectId && filter.projectId !== "all") {
      result = result.filter((r) => r.projectIds.has(filter.projectId!));
    }

    return result.map((r) => ({
      evidence: r.evidence,
      projectIds: [...r.projectIds],
      narrativeIds: [...r.narrativeIds],
      snapshotId: r.snapshotId,
    }));
  }

  /**
   * M35: Check the health of all configured data providers.
   * Surfaces the existing SourceHealthMonitor through the API/UI.
   */
  async checkSourceHealth(): Promise<import("@insight/data").SourceHealthReport> {
    const { checkSourceHealth } = await import("@insight/data");
    const checkedAt = new Date().toISOString();
    return checkSourceHealth(this.providers, { checkedAt });
  }

  /**
   * M38: Global search across projects, narratives, and evidence.
   *
   * Deterministic text matching over existing Insight data — no external
   * search service, no AI, no web search. Matches on name, description,
   * note, and source fields. Results are sorted by relevance tier:
   * exact name > name contains > description/note contains.
   */
  async search(query: string): Promise<{
    query: string;
    projects: { id: string; name: string; category: string; description: string }[];
    narratives: { id: string; name: string; trend: string; note: string }[];
    evidence: { id: string; sourceName: string; note: string; status: string }[];
    total: number;
  }> {
    await this.ready();
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return { query, projects: [], narratives: [], evidence: [], total: 0 };
    }

    const [projects, narratives] = await Promise.all([this.listProjects(), this.getNarratives()]);

    // Resolve evidence from latest snapshot or runtime
    let evidenceList: readonly Evidence[];
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      evidenceList = snapshots[snapshots.length - 1]?.evidence ?? [];
    } else {
      const result = this.runtime.analyze({ referenceDate: this.referenceDate });
      evidenceList = result.evidence;
    }

    const matchedProjects = projects
      .filter((p) => {
        const name = p.name.toLowerCase();
        const desc = p.description.toLowerCase();
        const cat = p.category.toLowerCase();
        return name.includes(q) || desc.includes(q) || cat.includes(q);
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === q ? 0 : 1;
        const bExact = bName === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aStarts = aName.startsWith(q) ? 0 : 1;
        const bStarts = bName.startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
      }));

    const matchedNarratives = narratives
      .filter((n) => {
        const name = n.name.toLowerCase();
        const note = n.note.toLowerCase();
        return name.includes(q) || note.includes(q);
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === q ? 0 : 1;
        const bExact = bName === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aStarts = aName.startsWith(q) ? 0 : 1;
        const bStarts = bName.startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      })
      .map((n) => ({
        id: n.id,
        name: n.name,
        trend: n.trend,
        note: n.note,
      }));

    const matchedEvidence = evidenceList
      .filter((e) => {
        const note = e.note.toLowerCase();
        const sourceName = e.source.name.toLowerCase();
        return note.includes(q) || sourceName.includes(q);
      })
      .map((e) => ({
        id: e.id,
        sourceName: e.source.name,
        note: e.note,
        status: e.status,
      }));

    return {
      query,
      projects: matchedProjects,
      narratives: matchedNarratives,
      evidence: matchedEvidence,
      total: matchedProjects.length + matchedNarratives.length + matchedEvidence.length,
    };
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
    await cache.delete("insight:knowledge-graph");
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
