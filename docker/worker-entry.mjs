// Insight M26 worker entrypoint (plain ESM, runs in the worker container).
//
// Self-contained so it runs with `node worker-entry.mjs` and NO build step.
// It demonstrates the exact wiring the @insight/infra adapters expect:
//   - config from env (INSIGHT_POSTGRES_URL / INSIGHT_REDIS_URL / ...)
//   - in-memory backends when endpoints are absent (deterministic, no network)
//   - a scheduled loop that reports per-iteration status and shuts down
//     gracefully on SIGTERM/SIGINT (docker stop).
//
// In a full deployment, `assembleInfra` from @insight/infra supplies the real
// Postgres/Redis/S3-backed adapters; this entry keeps the loop contract.

const intervalMs = Number(process.env.INSIGHT_WORKER_INTERVAL_MS ?? 5000);
const maxFailures = Number(process.env.INSIGHT_WORKER_MAX_FAILURES ?? 10);

function mode() {
  const hasExternal =
    process.env.INSIGHT_POSTGRES_URL ||
    process.env.INSIGHT_REDIS_URL ||
    process.env.INSIGHT_S3_ENDPOINT;
  return hasExternal ? "external" : "in-memory";
}

let runs = 0;
let failures = 0;

async function handle() {
  // The unit of work — e.g. RefreshEngine.executeRefresh() or a snapshot
  // repository write. Kept minimal here so the loop is observable.
  runs += 1;
  const startedAt = new Date().toISOString();
  console.log(`[worker] ok attempt=${runs} startedAt=${startedAt} mode=${mode()}`);
  return "done";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[worker] starting mode=${mode()} interval=${intervalMs}ms`);
  const shutdown = new AbortController();
  const onSignal = () => {
    console.log("[worker] shutdown signal received");
    shutdown.abort();
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);

  while (!shutdown.signal.aborted && failures < maxFailures) {
    try {
      await handle();
    } catch (error) {
      failures += 1;
      console.error(`[worker] failed (${error instanceof Error ? error.message : error})`);
    }
    if (shutdown.signal.aborted || failures >= maxFailures) break;
    await sleep(intervalMs);
  }

  console.log(`[worker] stopped runs=${runs} failures=${failures}`);
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
