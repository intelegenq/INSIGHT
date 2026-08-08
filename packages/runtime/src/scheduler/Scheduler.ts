/**
 * @insight/runtime/scheduler — minimal scheduler abstraction.
 *
 * Framework-free job registration and execution layer above InsightRuntime.
 * No cron, no timers, no I/O — pure deterministic execution.
 */
import type { RuntimeJob, ScheduledJob, ExecutionRecord } from "./types";
import { validateJobId, validateExecutionId, assertValid } from "../validation";
import { InsightErrors, normalizeError } from "../errors";
import type { RuntimeObserver } from "../observability";

export type Clock = () => string;
const defaultClock: Clock = () => new Date().toISOString();

export interface SchedulerOptions {
  clock?: Clock;
  observer?: RuntimeObserver;
}

export class Scheduler {
  private readonly jobs: Map<string, ScheduledJob> = new Map();
  private readonly executions: Map<string, ExecutionRecord> = new Map();
  private executionCounter = 0;
  private readonly clock: Clock;
  private readonly observer: RuntimeObserver;

  constructor(options: SchedulerOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.observer = options.observer ?? { onEvent: () => undefined };
  }

  private generateExecutionId(): string {
    this.executionCounter += 1;
    return `exec-${this.executionCounter.toString(36).padStart(6, "0")}`;
  }

  private createExecutionRecord(jobId: string): ExecutionRecord {
    return {
      id: this.generateExecutionId(),
      jobId,
      status: "pending",
      startedAt: this.clock(),
      retryCount: 0,
    };
  }

  private updateExecution(id: string, updates: Partial<ExecutionRecord>): void {
    const existing = this.executions.get(id);
    if (existing) this.executions.set(id, { ...existing, ...updates });
  }

  register(job: ScheduledJob): this {
    assertValid(validateJobId(job.id), "Scheduler.register");
    this.jobs.set(job.id, job);
    return this;
  }

  unregister(id: string): this {
    assertValid(validateJobId(id), "Scheduler.unregister");
    this.jobs.delete(id);
    return this;
  }

  get(id: string): ScheduledJob | undefined {
    assertValid(validateJobId(id), "Scheduler.get");
    return this.jobs.get(id);
  }

  list(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  async execute(id: string): Promise<ReturnType<RuntimeJob["execute"]>> {
    assertValid(validateJobId(id), "Scheduler.execute");
    const job = this.jobs.get(id);
    if (!job) throw InsightErrors.notFound("Job", id);
    if (!job.enabled) throw InsightErrors.validationError(`Job disabled: ${id}`, { jobId: id });

    const execution = this.createExecutionRecord(id);
    this.executions.set(execution.id, execution);
    this.updateExecution(execution.id, { status: "running" });
    this.observer.onEvent({
      type: "execution.started",
      executionId: execution.id,
      jobId: id,
      timestamp: execution.startedAt,
    });

    const startedAt = execution.startedAt;
    try {
      const result = await job.execute(job.options);
      const completedAt = this.clock();
      const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
      this.updateExecution(execution.id, { status: "completed", completedAt, durationMs, result });
      this.observer.onEvent({
        type: "execution.completed",
        executionId: execution.id,
        jobId: id,
        timestamp: completedAt,
        durationMs,
      });
      return result;
    } catch (error) {
      const completedAt = this.clock();
      const normalized = normalizeError(error);
      const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
      this.updateExecution(execution.id, {
        status: "failed",
        completedAt,
        durationMs,
        errorCode: normalized.code,
        error: normalized.message,
      });
      this.observer.onEvent({
        type: "execution.failed",
        executionId: execution.id,
        jobId: id,
        timestamp: completedAt,
        durationMs,
        errorCode: normalized.code,
      });
      throw error;
    }
  }

  getExecution(id: string): ExecutionRecord | undefined {
    assertValid(validateExecutionId(id), "Scheduler.getExecution");
    return this.executions.get(id);
  }

  listExecutions(): ExecutionRecord[] {
    return Array.from(this.executions.values());
  }

  has(id: string): boolean {
    assertValid(validateJobId(id), "Scheduler.has");
    return this.jobs.has(id);
  }

  clear(): this {
    this.jobs.clear();
    return this;
  }

  clearExecutions(): this {
    this.executions.clear();
    this.executionCounter = 0;
    return this;
  }

  getExecutionCount(): number {
    return this.executionCounter;
  }
}

export const scheduler = new Scheduler();
