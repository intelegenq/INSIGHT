/**
 * @insight/runtime/scheduler — minimal scheduler abstraction.
 *
 * Framework-free job registration and execution layer above InsightRuntime.
 * No cron, no timers, no I/O — pure deterministic execution.
 */
import type { RuntimeJob, ScheduledJob, ExecutionRecord, ExecutionStatus } from "./types";

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

  /** Generate a unique execution ID. */
  private generateExecutionId(): string {
    this.executionCounter++;
    return `exec-${Date.now()}-${this.executionCounter}`;
  }

  /** Create a new execution record with pending status. */
  private createExecutionRecord(jobId: string): ExecutionRecord {
    const now = new Date().toISOString();
    return {
      id: this.generateExecutionId(),
      jobId,
      status: "pending",
      startedAt: now,
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
    this.jobs.set(job.id, job);
    return this;
  }

  /** Unregister a job by id. */
  unregister(id: string): this {
    this.jobs.delete(id);
    return this;
  }

  /** Get a job by id. */
  get(id: string): ScheduledJob | undefined {
    return this.jobs.get(id);
  }

  /** List all registered jobs. */
  list(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /** Execute a job by id with its registered options. */
  async execute(id: string): Promise<ReturnType<RuntimeJob["execute"]>> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }
    if (!job.enabled) {
      throw new Error(`Job disabled: ${id}`);
    }

    // Create execution record
    const execution = this.createExecutionRecord(id);
    this.executions.set(execution.id, execution);

    // Mark as running
    this.updateExecution(execution.id, { status: "running" });

    try {
      const result = await job.execute(job.options);

      // Mark as completed
      this.updateExecution(execution.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        result,
      });

      return result;
    } catch (error) {
      // Mark as failed
      this.updateExecution(execution.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /** Get an execution record by id. */
  getExecution(id: string): ExecutionRecord | undefined {
    return this.executions.get(id);
  }

  /** List all execution records. */
  listExecutions(): ExecutionRecord[] {
    return Array.from(this.executions.values());
  }

  /** Check if a job is registered. */
  has(id: string): boolean {
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
}

/** Default scheduler instance. */
export const scheduler = new Scheduler();