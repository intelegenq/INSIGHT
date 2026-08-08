/**
 * @insight/runtime/snapshot — Scheduler ↔ Snapshot integration.
 *
 * Optional integration layer that captures every successful job execution
 * into a {@link SnapshotRepository}. The Scheduler and RuntimeJob contracts
 * remain unchanged: the wrapper preserves the original `RuntimeResult` return
 * type and adds persistence as a side effect.
 *
 * The wrapper is split into two flavours that mirror the repository
 * flavours exposed in {@link SnapshotRepository}:
 *   - {@link snapshottingRuntimeJob}      — for sync repositories
 *   - {@link asyncSnapshottingRuntimeJob} — for async repositories
 *
 * Both flavours are fail-loud: a repository error or an integrity
 * verification failure surfaces to the caller. The Scheduler will mark
 * the job execution as failed and the runtime result will not be
 * reported as successful.
 */

import type { RuntimeOptions, RuntimeResult } from "../types";
import type { RuntimeJob } from "../scheduler/types";
import type { Snapshot, SyncSnapshotRepository, AsyncSnapshotRepository } from "../snapshot";
import { snapshotFromRuntimeResult } from "../snapshot/createSnapshot";
import { verifySnapshot, type IntegrityReport } from "../snapshot/Snapshot";

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
 * Configuration for {@link snapshottingRuntimeJob} /
 * {@link asyncSnapshottingRuntimeJob}.
 */
export interface SnapshottingJobOptions {
  /**
   * Predicate deciding whether a result should be snapshotted.
   * Defaults to "always save".
   */
  shouldSnapshot?: (result: RuntimeResult) => boolean;
  /**
   * Integrity policy:
   *   - "off"      — no verification (default)
   *   - "warn"     — log a warning when integrity fails
   *   - "throw"    — throw an error when integrity fails
   *
   * The verification re-derives the snapshot id from the content and
   * checks the embedded content hash matches the actual content.
   */
  integrityCheck?: IntegrityCheckMode;
  /**
   * Optional callback receiving integrity reports. Useful for tests
   * and structured logging.
   */
  onIntegrityReport?: (report: IntegrityReport) => void;
}

export type IntegrityCheckMode = "off" | "warn" | "throw";

/**
 * Wrap an existing {@link RuntimeJob} with snapshot persistence using
 * a sync repository.
 */
export function snapshottingRuntimeJob<TJob extends RuntimeJob>(
  job: TJob,
  repository: SyncSnapshotRepository,
  config: SnapshottingJobOptions = {},
): RuntimeJob & {
  getLastSnapshot(): Snapshot | undefined;
  getLastIntegrityReport(): IntegrityReport | undefined;
} {
  const shouldSnapshot = config.shouldSnapshot ?? (() => true);
  const integrity = config.integrityCheck ?? "off";
  let lastSnapshot: Snapshot | undefined;
  let lastIntegrityReport: IntegrityReport | undefined;

  const wrapped: RuntimeJob = {
    id: job.id,
    name: job.name,
    options: job.options,
    execute(options: RuntimeOptions): Promise<RuntimeResult> {
      const inner = job.execute(options);
      return Promise.resolve(inner).then((result) => {
        if (shouldSnapshot(result)) {
          const snap = snapshotFromRuntimeResult(result, options, job.id);
          const report = verifySnapshot(snap);
          lastIntegrityReport = report;
          if (config.onIntegrityReport) {
            config.onIntegrityReport(report);
          }
          if (!report.idValid || !report.contentValid) {
            if (integrity === "throw") {
              throw new Error(
                `Snapshot integrity check failed for ${snap.id}: ${report.reason ?? "unknown"}`,
              );
            }
            if (integrity === "warn") {
              // eslint-disable-next-line no-console
              console.warn(
                `[insight] snapshot integrity warning for ${snap.id}: ${report.reason ?? "unknown"}`,
              );
            }
          }
          lastSnapshot = repository.save(snap);
        }
        return result;
      });
    },
  };

  return Object.assign(wrapped, {
    getLastSnapshot(): Snapshot | undefined {
      return lastSnapshot;
    },
    getLastIntegrityReport(): IntegrityReport | undefined {
      return lastIntegrityReport;
    },
  });
}

/**
 * Async counterpart of {@link snapshottingRuntimeJob}. Works with
 * {@link AsyncSnapshotRepository} (filesystem, database, remote).
 *
 * A repository error is wrapped in a clear error message and rethrown so
 * the Scheduler records the execution as failed.
 */
export function asyncSnapshottingRuntimeJob<TJob extends RuntimeJob>(
  job: TJob,
  repository: AsyncSnapshotRepository,
  config: SnapshottingJobOptions = {},
): RuntimeJob & {
  getLastSnapshot(): Snapshot | undefined;
  getLastIntegrityReport(): IntegrityReport | undefined;
} {
  const shouldSnapshot = config.shouldSnapshot ?? (() => true);
  const integrity = config.integrityCheck ?? "off";
  let lastSnapshot: Snapshot | undefined;
  let lastIntegrityReport: IntegrityReport | undefined;

  const wrapped: RuntimeJob = {
    id: job.id,
    name: job.name,
    options: job.options,
    async execute(options: RuntimeOptions): Promise<RuntimeResult> {
      const result = await job.execute(options);
      if (shouldSnapshot(result)) {
        const snap = snapshotFromRuntimeResult(result, options, job.id);
        const report = verifySnapshot(snap);
        lastIntegrityReport = report;
        if (config.onIntegrityReport) {
          config.onIntegrityReport(report);
        }
        if (!report.idValid || !report.contentValid) {
          if (integrity === "throw") {
            throw new Error(
              `Snapshot integrity check failed for ${snap.id}: ${report.reason ?? "unknown"}`,
            );
          }
          if (integrity === "warn") {
            // eslint-disable-next-line no-console
            console.warn(
              `[insight] snapshot integrity warning for ${snap.id}: ${report.reason ?? "unknown"}`,
            );
          }
        }
        try {
          lastSnapshot = await repository.save(snap);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Snapshot save failed for ${snap.id}: ${message}`);
        }
      }
      return result;
    },
  };

  return Object.assign(wrapped, {
    getLastSnapshot(): Snapshot | undefined {
      return lastSnapshot;
    },
    getLastIntegrityReport(): IntegrityReport | undefined {
      return lastIntegrityReport;
    },
  });
}
