/**
 * @insight/runtime — deterministic orchestration layer for Insight.
 *
 * Thin coordination only: wires @insight/data, @insight/intelligence, and
 * @insight/knowledge together, and composes results. Contains no business
 * logic of its own. No React, no Next.js, no I/O, no Date.now(), no
 * randomness — every output is deterministic given its inputs.
 */

export type { RuntimeDashboard, RuntimeOptions, RuntimeResult, RuntimeSummary } from "./types";

export { defaultPipelineInput, runPipeline } from "./pipeline";
export type { PipelineInput, PipelineResult } from "./pipeline";

export { buildSummary, composeDashboard, composeRuntimeResult } from "./runtimeReport";

export { InsightRuntime, runtime } from "./runtime";

export {
  Scheduler,
  scheduler,
  type RuntimeJob,
  type ScheduledJob,
} from "./scheduler";

export {
  ReportGenerator,
  MarkdownRenderer,
  HtmlRenderer,
  JsonRenderer,
  type Report,
  type ReportFormat,
  type ReportMetadata,
  type ReportGeneratorConfig,
  DEFAULT_REPORT_CONFIG,
  generateReportId,
  calculateReportMetadata,
  generateSummary,
} from "./report/index";

export type { Snapshot, SnapshotRepository } from "./snapshot";
export { InMemorySnapshotRepository, createSnapshot, snapshotFromRuntimeResult } from "./snapshot";
export { snapshottingRuntimeJob } from "./snapshot/snapshottingJob";
export type { SnapshottingJobOptions, SnapshotExecutionInfo } from "./snapshot/snapshottingJob";

export { HistoryAnalyzer, trendRank } from "./history";
export type {
  ChangeDirection,
  HistoryDiff,
  HistorySummary,
  NarrativeChange,
  ProjectChange,
  ProjectMetricChange,
} from "./history";
