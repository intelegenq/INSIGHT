/**
 * @insight/runtime/scheduler — minimal scheduler abstraction.
 */
import type { RuntimeOptions, RuntimeResult } from "../types";
import type { ErrorCode } from "../errors";

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

  /** Duration in milliseconds, if the clock source can derive it. */
  durationMs?: number;

  /** Retry count, when execution was retried by a caller. */
  retryCount?: number;

  /** Snapshot identifier created by the execution, when applicable. */
  snapshotId?: string;

  /** Structured failure code for failed executions. */
  errorCode?: ErrorCode;

  /** Runtime result (available when completed). */
  result?: RuntimeResult;

  /** Error message (available when failed). */
  error?: string;
}
