/**
 * IngestionWorker — M29 scheduled data refresh worker.
 *
 * Wires the existing RefreshEngine (runtime) to the WorkerRunner loop
 * (infra), backed by production providers (data). The worker:
 *   1. Resolves live providers from environment credentials
 *   2. Constructs a CompositeRepository + RefreshEngine
 *   3. Persists refresh results via assembleInfra (PostgresSnapshotRepository)
 *   4. Runs the worker loop on an interval, executing refresh cycles
 *   5. Shuts down gracefully on SIGTERM/SIGINT
 *
 * Refresh state survives restart: snapshots are stored in Postgres (or
 * the in-memory SQL fallback in dev/test) so the web app can serve
 * the latest refreshed data across restarts.
 */
import {
  resolveProductionProviders,
  CompositeRepository,
  type DataProvider,
  type ProjectRepository,
} from "@insight/data";
import {
  RefreshEngine,
  DEFAULT_REFRESH_OPTIONS,
  createSnapshot,
  snapshotFromRuntimeResult,
  type RefreshResult,
  type Snapshot,
} from "@insight/runtime";
import {
  createWorkerRunner,
  drainShutdownSignal,
  resolveInfraConfig,
  assembleInfra,
  InMemorySqlClient,
  type WorkerSpec,
} from "@insight/infra";

export interface IngestionWorkerOptions {
  /** Override provider list (tests). Defaults to env-resolved production providers. */
  providers?: DataProvider[];
  /** Repository for the refresh engine (tests). Defaults to CompositeRepository. */
  repository?: ProjectRepository;
  /** Worker interval in ms. Defaults to env INSIGHT_WORKER_INTERVAL_MS or 300000 (5min). */
  intervalMs?: number;
  /** Max failures before the loop stops. Defaults to env or 10. */
  maxFailures?: number;
  /** Refresh options for the engine. Defaults to DEFAULT_REFRESH_OPTIONS. */
  refreshOptions?: typeof DEFAULT_REFRESH_OPTIONS;
  /** Override snapshot persistence (tests). Defaults to infra-resolved. */
  snapshotPersister?: { save: (snapshot: Snapshot) => Promise<Snapshot> };
}

export interface IngestionWorkerResult {
  providers: string[];
  runs: number;
  failures: number;
}

/**
 * Build a WorkerSpec that executes a refresh cycle on each iteration.
 * The spec is framework-free and can be run via createWorkerRunner.
 */
export function createIngestionWorkerSpec(options: IngestionWorkerOptions = {}): {
  spec: WorkerSpec;
  engine: RefreshEngine;
  providers: string[];
} {
  const providers = options.providers ?? resolveProductionProviders();
  const providerNames = providers.map((p) => p.id);

  const repository = options.repository ?? new CompositeRepository({ providers });

  const providerMap = new Map<string, DataProvider>();
  for (const provider of providers) {
    providerMap.set(provider.id, provider);
  }

  const engine = new RefreshEngine({
    providers: providerMap,
    defaultRuntimeOptions: options.refreshOptions ?? DEFAULT_REFRESH_OPTIONS,
    repository,
    autoRegister: true,
  });

  // Resolve snapshot persistence: explicit override > infra-resolved
  const persister = options.snapshotPersister ?? resolveSnapshotPersister();

  const spec: WorkerSpec = {
    name: "insight-ingestion",
    intervalMs: options.intervalMs ?? readIntervalFromEnv(),
    maxFailures: options.maxFailures ?? readMaxFailuresFromEnv(),
    handle: async (ctx) => {
      const result: RefreshResult = await engine.triggerRefresh();
      if (!result.success) {
        throw new Error(result.error ?? "Refresh failed");
      }

      // Persist the refresh result as a snapshot so it survives restarts
      // and is available to the web app via the API routes.
      if (result.result) {
        const snapshot = snapshotFromRuntimeResult(
          result.result,
          {
            referenceDate: result.result.timestamp,
            ...options.refreshOptions,
          },
          engine.getJobId(),
        );
        await persister.save(snapshot);
      }

      return `refresh ok attempt=${ctx.attempt} duration=${result.durationMs}ms`;
    },
  };

  return { spec, engine, providers: providerNames };
}

/**
 * Resolve the snapshot persistence backend from environment config.
 * When INSIGHT_POSTGRES_URL is set, uses PostgresSnapshotRepository via
 * assembleInfra. Otherwise falls back to InMemorySqlClient so the worker
 * still persists (in-memory, non-durable) for dev/test.
 */
function resolveSnapshotPersister(): { save: (snapshot: Snapshot) => Promise<Snapshot> } {
  const config = resolveInfraConfig();
  const sql = new InMemorySqlClient();
  const services = assembleInfra({ config, sql });
  // Initialize the schema (idempotent) so save() works on first call
  const repo = services.snapshotRepository;
  repo.initialize().catch(() => {
    // Swallow — save() will fail gracefully if schema isn't ready
  });
  return repo;
}

/**
 * Run the ingestion worker until SIGTERM/SIGINT.
 * This is the production entry point — used by the Docker worker container.
 */
export async function runIngestionWorker(
  options: IngestionWorkerOptions = {},
): Promise<IngestionWorkerResult> {
  const { spec, providers } = createIngestionWorkerSpec(options);
  const runner = createWorkerRunner(spec);
  const controller = drainShutdownSignal();

  const { runs, failures } = await runner.run({
    signal: controller.signal,
    log: (line: string) => console.log(`[ingestion-worker] ${line}`),
  });

  return { providers, runs, failures };
}

function readIntervalFromEnv(): number {
  const raw = process.env["INSIGHT_WORKER_INTERVAL_MS"];
  if (raw === undefined) return 300_000; // 5 minutes default
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 300_000 : parsed;
}

function readMaxFailuresFromEnv(): number {
  const raw = process.env["INSIGHT_WORKER_MAX_FAILURES"];
  if (raw === undefined) return 10;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 10 : parsed;
}
