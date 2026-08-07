/**
 * @insight/runtime/snapshot — public exports.
 */

export type { Snapshot } from "./Snapshot";
export { buildSnapshotId, hashSnapshotContent } from "./Snapshot";

export type { SnapshotRepository } from "./SnapshotRepository";
export { InMemorySnapshotRepository } from "./InMemorySnapshotRepository";

export { createSnapshot, snapshotFromRuntimeResult } from "./createSnapshot";
export { snapshottingRuntimeJob } from "./snapshottingJob";
export type { SnapshottingJobOptions, SnapshotExecutionInfo } from "./snapshottingJob";