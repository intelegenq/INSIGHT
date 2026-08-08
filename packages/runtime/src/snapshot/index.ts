/**
 * @insight/runtime/snapshot — public exports.
 */

export type { Snapshot } from "./Snapshot";
export { buildSnapshotId, hashSnapshotContent, verifySnapshotId, verifySnapshot } from "./Snapshot";
export type { IntegrityReport } from "./Snapshot";

export type {
  SnapshotRepository,
  SyncSnapshotRepository,
  AsyncSnapshotRepository,
} from "./SnapshotRepository";
export { InMemorySnapshotRepository } from "./InMemorySnapshotRepository";
export { FileSnapshotRepository } from "./FileSnapshotRepository";
export type { FileSnapshotRepositoryOptions } from "./FileSnapshotRepository";

export { createSnapshot, snapshotFromRuntimeResult } from "./createSnapshot";
export { snapshottingRuntimeJob } from "./snapshottingJob";
export type { SnapshottingJobOptions, SnapshotExecutionInfo } from "./snapshottingJob";
