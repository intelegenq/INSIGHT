/**
 * @insight/runtime/snapshot — Scheduler ↔ Snapshot integration.
 *
 * Optional integration layer that captures every successful job execution
 * into a {@link SnapshotRepository}. The Scheduler and RuntimeJob contracts
 * remain unchanged: the wrapper preserves the original `RuntimeResult` return
 * type and adds persistence as a side effect.
 */

import type { RuntimeOptions, RuntimeResult } from "../types";
import type { RuntimeJob } from "../scheduler/types";
import type { Snapshot, SnapshotRepository } from "../snapshot";
import { snapshotFromRuntimeResult } from "../snapshot/createSnapshot";

/**
 * Information about the snapshot produced by the most recent execution of a
 * snapshotting job. Null when the job hasn't run yet or the result was
 * rejected.
 */
export interface SnapshotExecutionInfo {
  /** Snapshot that was persisted, when one was created. */
  snapshot: Snapshot;
  /** Runtime options that produced this snapshot. */
  options: RuntimeOptions;
}

/**
 * Configuration for {@link snapshottingRuntimeJob}.
 */
export interface SnapshottingJobOptions {
  /** Repository where snapshots are persisted. */
  repository: SnapshotRepository;
  /**
   * Predicate deciding whether a result should be snapshotted.
   * Defaults to "always save".
   */
  shouldSnapshot?: (result: RuntimeResult) => boolean;
}

/**
 * Wrap an existing {@link RuntimeJob} with snapshot persistence.
 *
 * The wrapper preserves the original `RuntimeJob` shape: same id, name,
 * options, and execute() returning `Promise<RuntimeResult>`. As a side
 * effect, every accepted execution also writes a snapshot to the configured
 * repository.
 *
 * The last persisted snapshot can be retrieved via {@link getLastSnapshot}.
 */
export function snapshottingRuntimeJob<TJob extends RuntimeJob>(
  job: TJob,
  config: SnapshottingJobOptions,
): RuntimeJob & {
  /** Return the most recent snapshot written by this job, if any. */
  getLastSnapshot(): Snapshot | undefined;
} {
  const shouldSnapshot = config.shouldSnapshot ?? (() => true);
  let lastSnapshot: Snapshot | undefined;

  const wrapped: RuntimeJob = {
    id: job.id,
    name: job.name,
    options: job.options,
    execute(options: RuntimeOptions): Promise<RuntimeResult> {
      const inner = job.execute(options);
      return Promise.resolve(inner).then((result) => {
        if (shouldSnapshot(result)) {
          lastSnapshot = config.repository.save(
            snapshotFromRuntimeResult(result, options, job.id),
          );
        }
        return result;
      });
    },
  };

  return Object.assign(wrapped, {
    getLastSnapshot(): Snapshot | undefined {
      return lastSnapshot;
    },
  });
}