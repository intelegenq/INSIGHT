/**
 * @insight/runtime/scheduler — InsightRuntime job adapter.
 *
 * Concrete RuntimeJob implementation that wraps InsightRuntime.
 * Scheduler decides when to run; Job decides what to execute.
 */
import type { RuntimeOptions, RuntimeResult } from "../types";
import type { RuntimeJob } from "./types";
import { InsightRuntime } from "../runtime";

/**
 * InsightRuntimeJob — adapts InsightRuntime.analyze() to RuntimeJob interface.
 */
export class InsightRuntimeJob implements RuntimeJob {
  readonly id: string;
  readonly name: string;
  readonly options: RuntimeOptions;

  private readonly runtime: InsightRuntime;

  constructor(
    id: string,
    name: string,
    options: RuntimeOptions,
    runtime?: InsightRuntime,
  ) {
    this.id = id;
    this.name = name;
    this.options = options;
    this.runtime = runtime ?? InsightRuntime.create();
  }

  /** Execute the job by delegating to InsightRuntime.analyze(). */
  async execute(options: RuntimeOptions): Promise<RuntimeResult> {
    // RuntimeResult is returned synchronously from analyze, but we wrap in Promise
    // to satisfy the RuntimeJob interface contract.
    return this.runtime.analyze(options);
  }
}