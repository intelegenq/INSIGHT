/**
 * RetryPolicy — deterministic exponential backoff.
 *
 * Pure computation: given an attempt number it returns the delay before the
 * next retry, without randomness or I/O. All configurable values are fixed
 * up front.
 */

export interface RetryConfig {
  /** Maximum number of retry attempts (attempts beyond the first). */
  maxRetry: number;
  /** Base delay between retries, in milliseconds. */
  baseDelay: number;
  /** Upper bound for the backoff delay, in milliseconds. */
  maxDelay: number;
  /** Backoff multiplier applied each attempt. Defaults to 2. */
  factor?: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetry: 3,
  baseDelay: 100,
  maxDelay: 2_000,
  factor: 2,
};

/** Compute the delay, in ms, before retry `attempt` (0-indexed). */
export function computeBackoff(config: RetryConfig, attempt: number): number {
  if (attempt < 0) {
    return 0;
  }
  const factor = config.factor ?? 2;
  const delay = config.baseDelay * Math.pow(factor, attempt);
  return Math.min(delay, config.maxDelay);
}

/** True when `attempt` should trigger a retry (attempt < maxRetry). */
export function shouldRetry(config: RetryConfig, attempt: number): boolean {
  return attempt < config.maxRetry;
}

/**
 * Compute the full schedule of retry delays for a configuration.
 * Deterministic and finite.
 */
export function retrySchedule(config: RetryConfig): number[] {
  const delays: number[] = [];
  for (let attempt = 0; attempt < config.maxRetry; attempt += 1) {
    delays.push(computeBackoff(config, attempt));
  }
  return delays;
}

/** RetryPolicy — stores config and exposes deterministic retry helpers. */
export class RetryPolicy {
  readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      factor: DEFAULT_RETRY_CONFIG.factor,
      ...config,
    };
  }

  /** Delay in ms before the given (0-indexed) retry attempt. */
  delayFor(attempt: number): number {
    return computeBackoff(this.config, attempt);
  }

  /** Whether a retry should happen after `attempt` failed. */
  canRetry(attempt: number): boolean {
    return shouldRetry(this.config, attempt);
  }
}
