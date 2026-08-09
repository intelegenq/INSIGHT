/**
 * IngestionWorker — M29 scheduled data refresh worker.
 *
 * Wires the existing RefreshEngine (runtime) to the WorkerRunner loop
 * (infra), backed by production providers (data). The worker:
 *   1. Resolves live providers from environment credentials
 *   2. Constructs a CompositeRepository + RefreshEngine
 *   3. Runs the worker loop on an interval, executing refresh cycles
 *   4. Shuts down gracefully on SIGTERM/SIGINT
 *
 * This replaces the stub docker/worker-entry.mjs with real wiring.
 * Tests inject mock providers + mock transport to verify the wiring
 * without touching the network.
 */
import {
  resolveProductionProviders,
  CompositeRepository,
  type DataProvider,
  type ProjectRepository,
} from "@insight/data";
import { RefreshEngine, DEFAULT_REFRESH_OPTIONS, type RefreshResult } from "@insight/runtime";
import { createWorkerRunner, drainShutdownSignal, type WorkerSpec } from "@insight/infra";

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

  const spec: WorkerSpec = {
    name: "insight-ingestion",
    intervalMs: options.intervalMs ?? readIntervalFromEnv(),
    maxFailures: options.maxFailures ?? readMaxFailuresFromEnv(),
    handle: async (ctx) => {
      const result: RefreshResult = await engine.triggerRefresh();
      if (!result.success) {
        throw new Error(result.error ?? "Refresh failed");
      }
      return `refresh ok attempt=${ctx.attempt} duration=${result.durationMs}ms`;
    },
  };

  return { spec, engine, providers: providerNames };
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
    log: (line) => console.log(`[ingestion-worker] ${line}`),
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
