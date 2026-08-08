/**
 * @insight/runtime/scheduler — minimal scheduler abstraction.
 *
 * Framework-free job registration and execution layer above InsightRuntime.
 * No cron, no timers, no I/O — pure deterministic execution.
 */
import type { RuntimeJob, ScheduledJob, ExecutionRecord, ExecutionStatus } from "./types";
import { validateJobId, validateExecutionId, assertValid } from "../validation";
import { InsightErrors, getErrorCode } from "../errors";

/**
 * Clock — supplies the current time as an ISO-8601 string. Injectable
 * so tests and the snapshot pipeline can drive the scheduler with a
 * fixed timeline.
 */
export type Clock = () => string;

/** Default clock: ISO-8601 from the platform clock. */
const defaultClock: Clock = () => new Date().toISOString();

/**
 * SchedulerOptions — configuration for the Scheduler instance.
 */
export interface SchedulerOptions {
  /** Clock used to stamp execution records. Defaults to the platform clock. */
  clock?: Clock;
}

/**
 * Scheduler — manages registered jobs and executes them on demand.
 *
 * Does NOT:
 * - run timers or cron
 * - perform I/O
 * - mutate job state beyond registration
 */
export class Scheduler {
  private readonly jobs: Map<string, ScheduledJob> = new Map();
  private readonly executions: Map<string, ExecutionRecord> = new Map();
  private executionCounter = 0;
  private readonly clock: Clock;

  constructor(options: SchedulerOptions = {}) {
    this.clock = options.clock ?? defaultClock;
  }

  /** Generate a unique execution ID. */
  private generateExecutionId(): string {
    this.executionCounter += 1;
    return `exec-${this.executionCounter.toString(36).padStart(6, "0")}`;
  }

  /** Create a new execution record with pending status. */
  private createExecutionRecord(jobId: string): ExecutionRecord {
    return {
      id: this.generateExecutionId(),
      jobId,
      status: "pending",
      startedAt: this.clock(),
      retryCount: 0,
    };
  }

  /** Update an execution record. */
  private updateExecution(id: string, updates: Partial<ExecutionRecord>): void {
    const existing = this.executions.get(id);
    if (existing) {
      this.executions.set(id, { ...existing, ...updates });
    }
  }

  /** Register a job. Overwrites if id exists. */
  register(job: ScheduledJob): this {
    // Validate job ID
    assertValid(validateJobId(job.id), "Scheduler.register");
    this.jobs.set(job.id, job);
    return this;
  }

  /** Unregister a job by id. */
  unregister(id: string): this {
    assertValid(validateJobId(id), "Scheduler.unregister");
    this.jobs.delete(id);
    return this;
  }

  /** Get a job by id. */
  get(id: string): ScheduledJob | undefined {
    assertValid(validateJobId(id), "Scheduler.get");
    return this.jobs.get(id);
  }

  /** List all registered jobs. */
  list(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /** Execute a job by id with its registered options. */
  async execute(id: string): Promise<ReturnType<RuntimeJob["execute"]>> {
    assertValid(validateJobId(id), "Scheduler.execute");
    const job = this.jobs.get(id);
    if (!job) {
      throw InsightErrors.notFound("Job", id);
    }
    if (!job.enabled) {
      throw InsightErrors.validationError(`Job disabled: ${id}`, { jobId: id });
    }

    const execution = this.createExecutionRecord(id);
    this.executions.set(execution.id, execution);
    this.updateExecution(execution.id, { status: "running" });

    const startedAt = execution.startedAt;

    try {
      const result = await job.execute(job.options);
      const completedAt = this.clock();
      this.updateExecution(execution.id, {
        status: "completed",
        completedAt,
        durationMs: Date.parse(completedAt) - Date.parse(startedAt),
        result,
      });
      return result;
    } catch (error) {
      const completedAt = this.clock();
      const structured = error instanceof Error ? getErrorCode(error) : undefined;
      this.updateExecution(execution.id, {
        status: "failed",
        completedAt,
        durationMs: Date.parse(completedAt) - Date.parse(startedAt),
        errorCode: structured,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Get an execution record by id. */
  getExecution(id: string): ExecutionRecord | undefined {
    assertValid(validateExecutionId(id), "Scheduler.getExecution");
    return this.executions.get(id);
  }

  /** List all execution records. */
  listExecutions(): ExecutionRecord[] {
    return Array.from(this.executions.values());
  }

  /** Check if a job is registered. */
  has(id: string): boolean {
    assertValid(validateJobId(id), "Scheduler.has");
    return this.jobs.has(id);
  }

  /** Clear all jobs. */
  clear(): this {
    this.jobs.clear();
    return this;
  }

  /** Clear all execution records. */
  clearExecutions(): this {
    this.executions.clear();
    this.executionCounter = 0;
    return this;
  }

  /** Get the current execution counter (for snapshotting). */
  getExecutionCount(): number {
    return this.executionCounter;
  }
}

/** Default scheduler instance. */
export const scheduler = new Scheduler();
