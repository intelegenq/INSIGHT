/**
 * @insight/runtime/scheduler — minimal scheduler abstraction.
 *
 * Framework-free job registration and execution layer above InsightRuntime.
 * No cron, no timers, no I/O — pure deterministic execution.
 */
import type { RuntimeJob, ScheduledJob } from "./types";

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
    return job.execute(job.options);
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
}

/** Default scheduler instance. */
export const scheduler = new Scheduler();