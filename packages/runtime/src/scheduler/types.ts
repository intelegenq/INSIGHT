/**
 * @insight/runtime/scheduler — minimal scheduler abstraction.
 *
 * Framework-free job registration and execution layer above InsightRuntime.
 * No cron, no timers, no I/O — pure deterministic execution.
 */
import type { RuntimeOptions, RuntimeResult } from "../types";

/**
 * RuntimeJob — a single unit of work that produces a RuntimeResult.
 */
export interface RuntimeJob {
  /** Unique job identifier. */
  id: string;

  /** Human-readable name. */
  name: string;

  /** Fixed runtime options for this job. */
  options: RuntimeOptions;

  /** Execute the job with given options. */
  execute: (options: RuntimeOptions) => Promise<RuntimeResult>;
}

/**
 * ScheduledJob — a job with scheduling metadata.
 */
export interface ScheduledJob extends RuntimeJob {
  /** Cron expression (informational only — no timer attached). */
  cron?: string;

  /** Whether the job is enabled. */
  enabled: boolean;

  /** Optional: tags for filtering/grouping. */
  tags?: string[];
}

/**
 * ExecutionStatus — lifecycle state of a job execution.
 */
export type ExecutionStatus = "pending" | "running" | "completed" | "failed";

/**
 * ExecutionRecord — tracks a single job execution lifecycle.
 */
export interface ExecutionRecord {
  /** Unique execution identifier. */
  id: string;

  /** Job identifier that was executed. */
  jobId: string;

  /** Current status of the execution. */
  status: ExecutionStatus;

  /** ISO timestamp when execution started. */
  startedAt: string;

  /** ISO timestamp when execution completed (if finished). */
  completedAt?: string;

  /** Runtime result (available when completed). */
  result?: RuntimeResult;

  /** Error message (available when failed). */
  error?: string;
}