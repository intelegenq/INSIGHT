/**
 * @insight/infra/worker — Docker-compatible worker runner.
 *
 * A minimal, reproducible worker loop that executes a {@link WorkerSpec}'s
 * `handle` job on an interval, honours a grace period for graceful shutdown
 * (SIGTERM/SIGINT), and reports per-iteration outcomes. It is agnostic to the
 * job's implementation — producers wire it to `RefreshEngine`/`Scheduler` or
 * any poller. Kept dependency-free so it runs in a plain Node container.
 */

export interface WorkerSpec {
  /** Human-readable worker name. */
  name: string;
  /** Run one unit of work. Return a short status string for logging. */
  handle: (ctx: { attempt: number; startedAt: string }) => Promise<string>;
  /** Delay between iterations in ms. */
  intervalMs?: number;
  /** Max consecutive failures before the loop stops. */
  maxFailures?: number;
}

export interface WorkerRunOptions {
  /** Abort trigger (e.g. an AbortController). When aborted, stops gracefully. */
  signal: AbortSignal;
  /** Log sink; defaults to console. */
  log?: (line: string) => void;
}

/** Continuously run a worker until the abort signal fires. */
export async function runWorkerLoop(
  spec: WorkerSpec,
  options: WorkerRunOptions,
): Promise<{ runs: number; failures: number }> {
  const intervalMs = spec.intervalMs ?? 5_000;
  const maxFailures = spec.maxFailures ?? 10;
  const log = options.log ?? ((line: string) => console.log(`[worker:${spec.name}] ${line}`));

  let runs = 0;
  let failures = 0;
  let attempt = 0;

  while (!options.signal.aborted && failures < maxFailures) {
    const startedAt = new Date().toISOString();
    try {
      const status = await spec.handle({ attempt, startedAt });
      attempt += 1;
      runs += 1;
      log(`ok (${status}) #${attempt}`);
    } catch (error) {
      failures += 1;
      attempt += 1;
      log(`failed (${error instanceof Error ? error.message : String(error)}) #${attempt}`);
    }
    // Poll the signal before sleeping to stop promptly on shutdown.
    if (options.signal.aborted || failures >= maxFailures) break;
    await sleep(intervalMs, options.signal);
  }

  return { runs, failures };
}

/** Wait `ms`, aborting early when the signal fires. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      done();
    });
  });
}

/** Create a worker runner bound to a spec (for dependency injection). */
export interface WorkerRunner {
  run(options: WorkerRunOptions): Promise<{ runs: number; failures: number }>;
}

export function createWorkerRunner(spec: WorkerSpec): WorkerRunner {
  return {
    run(options) {
      return runWorkerLoop(spec, options);
    },
  };
}

/**
 * Drain the process shutdown signals (SIGTERM/SIGINT) into an AbortController.
 * Useful for `docker stop` / Ctrl-C graceful shutdown wiring.
 */
export function drainShutdownSignal(): AbortController {
  const controller = new AbortController();
  const onSignal = () => controller.abort();
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
  return controller;
}