/**
 * M29 ingestion worker — production entry point.
 *
 * Runs the scheduled data refresh loop until SIGTERM/SIGINT.
 * Wires live providers from env, RefreshEngine, and WorkerRunner.
 */
import { runIngestionWorker } from "./index.js";

runIngestionWorker()
  .then(({ providers, runs, failures }) => {
    console.log(
      `[ingestion-worker] stopped providers=[${providers.join(",")}] runs=${runs} failures=${failures}`,
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("[ingestion-worker] fatal", error);
    process.exit(1);
  });
