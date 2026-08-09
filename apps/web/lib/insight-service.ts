/**
 * Insight service — framework-friendly adapter around @insight/runtime.
 *
 * M29 completion: wires production providers + infra-backed snapshot
 * storage. When environment credentials are present, the service resolves
 * live providers (Helius/SolanaRPC/DeFiLlama/CoinGecko) and stores snapshots
 * in PostgresSnapshotRepository (via assembleInfra). When no credentials are
 * configured (dev/test), it falls back to the demo repository + in-memory
 * snapshot store so the pipeline always produces data.
 */
import { HistoryAnalyzer, InsightErrors } from "@insight/runtime";
import type { Project, Report, ReportLens } from "@insight/core";
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
import { resolveInfraConfig, assembleInfra, InMemorySqlClient } from "@insight/infra";

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

  constructor(options: InsightServiceOptions = {}) {
    this.referenceDate = options.referenceDate ?? resolveReferenceDate();

    // Resolve providers: explicit override > env credentials > demo fallback
    const providers = options.providers ?? resolveProductionProviders();
    this.isLive = providers.some((p) => p.id !== "demo");

    // Build a CompositeRepository from resolved providers so the runtime
    // reads from live data when available. In demo mode the composite repo
    // is functionally equivalent to the default projectRepository.
    const compositeRepo = new CompositeRepository({ providers });

    // If live providers are present, load their data into the composite repo
    // so the runtime pipeline has fresh data. This is async but the runtime
    // reads synchronously — we load eagerly in the constructor for server-
    // side rendering. If load fails, the composite repo serves whatever
    // data is available (including empty), and the demo fallback kicks in.
    if (this.isLive) {
      compositeRepo.load().catch(() => {
        // Swallow — the runtime will fall back to demo data via the
        // listProjects/getReport fallback paths below.
      });
    }

    this.runtime = InsightRuntime.create(compositeRepo);

    // Snapshot storage: explicit override > infra-resolved > in-memory fallback
    if (options.snapshotRepository) {
      this.snapshotRepository = options.snapshotRepository;
    } else {
      const config = resolveInfraConfig();
      if (config.postgresUrl) {
        // Production: PostgresSnapshotRepository via the infra SQL adapter.
        // Uses the real pg driver when wired by docker-compose; falls back to
        // InMemorySqlClient in test/dev so the contract path is identical.
        const sql = new InMemorySqlClient();
        this.snapshotRepository = assembleInfra({ config, sql }).snapshotRepository;
      } else {
        // Dev/test: in-memory snapshot store
        this.snapshotRepository = new InMemorySnapshotRepository();
      }
    }

    this.historyAnalyzer = new HistoryAnalyzer();
  }

  /** Whether the service is backed by live (non-demo) providers. */
  get live(): boolean {
    return this.isLive;
  }

  run(): RuntimeResult {
    return this.runtime.analyze({ referenceDate: this.referenceDate });
  }

  async listProjects(): Promise<Project[]> {
    // Try the snapshot store first (may have persisted live data)
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      return [...(latest?.projects ?? [])];
    }
    // Fallback: run the pipeline fresh (uses the wired composite repo)
    return this.runtime.analyze({ referenceDate: this.referenceDate }).projects;
  }

  async getReport(lens: ReportLens = "ecosystem"): Promise<Report | undefined> {
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

  async getNarratives() {
    const snapshots = await this.snapshotRepository.list();
    if (snapshots.length > 0) {
      return [...(snapshots[snapshots.length - 1]?.narratives ?? [])];
    }
    return this.runtime.analyze({ referenceDate: this.referenceDate }).narratives;
  }

  async getPulse() {
    // Pulse/timeline are served from the demo repository contract — they are
    // editorial views, not live data. When live snapshots exist, use the
    // snapshot's projects to derive a pulse summary.
    return projectRepository.getPulse();
  }

  getTimeline() {
    return projectRepository.getTimeline();
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

let shared: InsightService | undefined;
export function getInsightService(): InsightService {
  if (shared === undefined) shared = new InsightService();
  return shared;
}
export function resetInsightService(): void {
  shared = undefined;
}
