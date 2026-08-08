/**
 * @insight/infra/observability — structured logging, metrics, traits.
 *
 * A framework-neutral observability sink. The default is a no-op so nothing
 * breaks without configuration; tests and real deployments can attach an
 * in-memory or console sink with zero external monitoring. This extends the
 * existing @insight/runtime observability contracts (RuntimeObserver /
 * RuntimeEvent) rather than replacing them.
 */

export type Severity = "debug" | "info" | "warn" | "error";

/** A structured, JSON-serializable log record. */
export interface LogRecord {
  severity: Severity;
  message: string;
  timestamp: string;
  /** Arbitrary structured attributes (tags, trace/execution ids). */
  attributes?: Record<string, unknown>;
  /** Optional correlation id spanning related records. */
  traceId?: string;
  /** Optional structured error fields. */
  error?: { code?: string; message?: string };
}

/** A discrete counter/event metric emission. */
export interface MetricRecord {
  name: string;
  delta: number;
  timestamp: string;
  attributes?: Record<string, unknown>;
}

/**
 * ObservabilitySink — a single place to emit logs, metrics, and trace-like
 * events. Implementations are free to be no-op, in-memory, or forward to a
 * real collector; the contract stays the same.
 */
export interface ObservabilitySink {
  /** Emit a structured log record. */
  log(record: LogRecord): void;
  /** Emit a metric event (counter/gauge delta). */
  metric(record: MetricRecord): void;
}

/** A no-op sink that discards everything (default). */
export const noopSink: ObservabilitySink = {
  log: () => undefined,
  metric: () => undefined,
};

/** Timestamp helper: ISO UTC now (injectable for deterministic tests). */
export type Clock = () => string;
export const systemClock: Clock = () => new Date().toISOString();
const defaultClock: Clock = systemClock;

/**
 * InMemorySink — records every emission for tests and observability
 * inspection. No external infrastructure required.
 */
export class InMemorySink implements ObservabilitySink {
  private readonly logs: LogRecord[] = [];
  private readonly metrics: MetricRecord[] = [];
  private readonly clock: Clock;

  constructor(clock: Clock = defaultClock) {
    this.clock = clock;
  }

  log(record: Omit<LogRecord, "timestamp"> & { timestamp?: string }): void {
    this.logs.push({ ...record, timestamp: record.timestamp ?? this.clock() });
  }

  metric(record: Omit<MetricRecord, "timestamp"> & { timestamp?: string }): void {
    this.metrics.push({ ...record, timestamp: record.timestamp ?? this.clock() });
  }

  /** All log records emitted so far. */
  getLogs(): readonly LogRecord[] {
    return this.logs;
  }

  /** All metric events emitted so far. */
  getMetrics(): readonly MetricRecord[] {
    return this.metrics;
  }

  /** Clear all buffered records. */
  reset(): void {
    this.logs.length = 0;
    this.metrics.length = 0;
  }
}