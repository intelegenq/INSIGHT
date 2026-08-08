/**
 * RefreshEngine — Automated data refresh pipeline for Insight.
 *
 * Orchestrates scheduled evidence collection, normalization, and pipeline execution.
 * Integrates with the existing Scheduler (runtime) and EvidenceCollector (data).
 * Pure orchestration layer — no business logic, only wiring existing components.
 */

import type { Evidence, Narrative, Project, Report, ReportLens } from "@insight/core";
import type { ProjectRepository } from "@insight/data";
import { EvidenceCollector } from "@insight/data";
import type { DataProvider } from "@insight/data";
import { InsightRuntime } from "@insight/runtime";
import type { RuntimeOptions, RuntimeResult } from "@insight/runtime";
import { Scheduler, type ScheduledJob, type ExecutionRecord } from "./scheduler";

export interface RefreshEngineConfig {
  /** Repository to use for data access (defaults to demo repo). */
  repository?: ProjectRepository;
  /** Providers to collect evidence from. */
  providers: Map<string, DataProvider>;
  /** Default runtime options for pipeline execution. */
  defaultRuntimeOptions: RuntimeOptions;
  /** Scheduler instance (creates new if not provided). */
  scheduler?: Scheduler;
  /** Whether to auto-register the refresh job on construction. */
  autoRegister?: boolean;
  /** Cron expression for the refresh job (informational only). */
  cronExpression?: string;
  /** Job ID for the refresh job. */
  jobId?: string;
  /** Job name for display. */
  jobName?: string;
}

export interface RefreshResult {
  /** Whether the refresh completed successfully. */
  success: boolean;
  /** Runtime result from the full pipeline execution. */
  result?: RuntimeResult;
  /** Execution record from the scheduler. */
  execution?: ExecutionRecord;
  /** Error message if failed. */
  error?: string;
  /** ISO timestamp when refresh started. */
  startedAt: string;
  /** ISO timestamp when refresh completed. */
  completedAt: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

export interface RefreshEngineStats {
  /** Total number of refresh executions. */
  totalExecutions: number;
  /** Number of successful executions. */
  successfulExecutions: number;
  /** Number of failed executions. */
  failedExecutions: number;
  /** Last execution record (if any). */
  lastExecution?: ExecutionRecord;
  /** Last successful result (if any). */
  lastSuccessfulResult?: RuntimeResult;
  /** Whether a refresh is currently running. */
  isRunning: boolean;
}

/**
 * RefreshEngine — schedules and executes automated data refreshes.
 *
 * Flow:
 * 1. EvidenceCollector gathers raw data from registered providers
 * 2. Normalizes to CanonicalEvidence via NormalizationRegistry
 * 3. Repository loads transformed data (CompositeRepository.load())
 * 4. InsightRuntime runs full pipeline (scoring, narratives, report, knowledge graph)
 * 5. Scheduler tracks execution lifecycle
 *
 * All components are existing — this engine only wires them together.
 */
export class RefreshEngine {
  private readonly config: Required<RefreshEngineConfig>;
  private readonly collector: EvidenceCollector;
  private readonly runtime: InsightRuntime;
  private readonly scheduler: Scheduler;
  private readonly jobId: string;
  private readonly jobName: string;
  private isExecuting = false;

  constructor(config: RefreshEngineConfig) {
    this.config = {
      repository: config.repository,
      providers: config.providers,
      defaultRuntimeOptions: config.defaultRuntimeOptions,
      scheduler: config.scheduler ?? new Scheduler(),
      autoRegister: config.autoRegister ?? true,
      cronExpression: config.cronExpression ?? "0 * * * *", // hourly default
      jobId: config.jobId ?? "insight-data-refresh",
      jobName: config.jobName ?? "Insight Data Refresh",
    } as Required<RefreshEngineConfig>;

    this.scheduler = this.config.scheduler;
    this.collector = new EvidenceCollector(this.config.providers);
    this.runtime = InsightRuntime.create(this.config.repository!);
    this.jobId = this.config.jobId;
    this.jobName = this.config.jobName;

    if (this.config.autoRegister) {
      this.registerRefreshJob();
    }
  }

  /**
   * Register the refresh job with the scheduler.
   */
  private registerRefreshJob(): void {
    const job: ScheduledJob = {
      id: this.jobId,
      name: this.jobName,
      cron: this.config.cronExpression,
      enabled: true,
      tags: ["data-refresh", "scheduled"],
      options: this.config.defaultRuntimeOptions,
      execute: async (options: RuntimeOptions) => {
        const result = await this.executeRefresh(options);
        if (!result.success) {
          throw new Error(result.error ?? "Refresh failed");
        }
        return result.result!;
      },
    };

    this.scheduler.register(job);
  }

  /**
   * Execute a single data refresh cycle.
   * This is the core orchestration method called by the scheduler.
   */
  async executeRefresh(options?: Partial<RuntimeOptions>): Promise<RefreshResult> {
    if (this.isExecuting) {
      return {
        success: false,
        error: "Refresh already in progress",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
      };
    }

    this.isExecuting = true;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      // 1. Collect and normalize evidence from all providers
      const collection = await this.collector.collect();

      // 2. Load repository with fresh data (if using CompositeRepository)
      if (this.config.repository && "load" in this.config.repository) {
        await (this.config.repository as { load: () => Promise<void> }).load();
      }

      // 3. Run full analysis pipeline with merged options
      const mergedOptions: RuntimeOptions = {
        ...this.config.defaultRuntimeOptions,
        ...options,
        repository: this.config.repository,
      };

      const result = this.runtime.analyze(mergedOptions);

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      this.isExecuting = false;

      return {
        success: true,
        result,
        startedAt,
        completedAt,
        durationMs,
      };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.isExecuting = false;

      return {
        success: false,
        error: errorMessage,
        startedAt,
        completedAt,
        durationMs,
      };
    }
  }

  /**
   * Manually trigger a refresh (bypasses scheduler).
   */
  async triggerRefresh(options?: Partial<RuntimeOptions>): Promise<RefreshResult> {
    return this.executeRefresh(options);
  }

  /**
   * Get the scheduler instance for external management.
   */
  getScheduler(): Scheduler {
    return this.scheduler;
  }

  /**
   * Get the evidence collector for direct access.
   */
  getCollector(): EvidenceCollector {
    return this.collector;
  }

  /**
   * Get the runtime instance for direct access.
   */
  getRuntime(): InsightRuntime {
    return this.runtime;
  }

  /**
   * Get current engine statistics.
   */
  getStats(): RefreshEngineStats {
    const executions = this.scheduler.listExecutions();
    const jobExecutions = executions.filter((e) => e.jobId === this.jobId);
    const successful = jobExecutions.filter((e) => e.status === "completed");
    const failed = jobExecutions.filter((e) => e.status === "failed");
    const lastExecution = jobExecutions.sort(
      (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
    )[0];

    const lastSuccessfulExecution = successful.sort(
      (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
    )[0];

    return {
      totalExecutions: jobExecutions.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      lastExecution,
      lastSuccessfulResult: lastSuccessfulExecution?.result,
      isRunning: this.isExecuting,
    };
  }

  /**
   * Enable or disable the scheduled refresh job.
   */
  setEnabled(enabled: boolean): this {
    const job = this.scheduler.get(this.jobId);
    if (job) {
      // ScheduledJob doesn't have setter for enabled, so we unregister and re-register
      this.scheduler.unregister(this.jobId);
      const updatedJob: ScheduledJob = { ...job, enabled };
      this.scheduler.register(updatedJob);
    }
    return this;
  }

  /**
   * Check if the refresh job is enabled.
   */
  isEnabled(): boolean {
    const job = this.scheduler.get(this.jobId);
    return job?.enabled ?? false;
  }

  /**
   * Get the job ID.
   */
  getJobId(): string {
    return this.jobId;
  }

  /**
   * Get the job name.
   */
  getJobName(): string {
    return this.jobName;
  }

  /**
   * Unregister the refresh job from the scheduler.
   */
  unregister(): this {
    this.scheduler.unregister(this.jobId);
    return this;
  }

  /**
   * Clear all execution history.
   */
  clearHistory(): this {
    this.scheduler.clearExecutions();
    return this;
  }
}

/**
 * Factory function to create a RefreshEngine with common defaults.
 */
export function createRefreshEngine(
  providers: Map<string, DataProvider>,
  defaultOptions: RuntimeOptions,
  overrides?: Partial<RefreshEngineConfig>,
): RefreshEngine {
  return new RefreshEngine({
    providers,
    defaultRuntimeOptions: defaultOptions,
    ...overrides,
  });
}

/**
 * Default runtime options for scheduled refreshes.
 * Can be overridden per-engine or per-execution.
 */
export const DEFAULT_REFRESH_OPTIONS: RuntimeOptions = {
  referenceDate: (() => {
    const iso = new Date().toISOString();
    const datePart = iso.split("T")[0];
    return datePart ?? iso.substring(0, 10);
  })(),
  lens: "ecosystem",
};
