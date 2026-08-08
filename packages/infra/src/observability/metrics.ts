/**
 * @insight/infra/observability — metrics helpers.
 *
 * Counters and gauges that forward deltas to an {@link ObservabilitySink}.
 * Deterministic and dependency-free; the sink decides where values land.
 */
import type { ObservabilitySink, Clock } from "./observability";
import { systemClock } from "./observability";

/** Inner helper to build a metric record. */
function emit(
  sink: ObservabilitySink,
  name: string,
  delta: number,
  timestamp: string,
): void {
  sink.metric({ name, delta, timestamp });
}

/** A monotonic counter, emission time-injected for testability. */
export class Counter {
  private value = 0;
  constructor(
    private readonly name: string,
    private readonly sink: ObservabilitySink,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Add a delta to the counter (default 1). */
  increment(delta = 1): number {
    this.value += delta;
    this.sink.metric({ name: this.name, delta, timestamp: this.clock() });
    return this.value;
  }

  get current(): number {
    return this.value;
  }
}

/** A push gauge updating an absolute value. */
export class Gauge {
  private value = 0;
  constructor(
    private readonly name: string,
    private readonly sink: ObservabilitySink,
    private readonly clock: Clock = systemClock,
  ) {}

  set(value: number): number {
    this.value = value;
    emit(this.sink, this.name, 0, this.clock());
    return this.value;
  }

  get current(): number {
    return this.value;
  }
}