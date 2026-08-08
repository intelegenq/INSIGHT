/**
 * RetryPolicy — deterministic exponential backoff.
 *
 * Pure computation: given an attempt number it returns the delay before the
 * next retry, without randomness or I/O. All configurable values are fixed
 * up front.
 */

/** Sleeper abstraction so tests can run instantly without real waits. */
export type Sleeper = (ms: number) => Promise<void>;

export interface RetryConfig {
  /** Maximum number of retry attempts (attempts beyond the first). */
  maxRetry: number;
  /** Base delay between retries, in milliseconds. */
  baseDelay: number;
  /** Upper bound for the backoff delay, in milliseconds. */
  maxDelay: number;
  /** Backoff multiplier applied each attempt. Defaults to 2. */
  factor?: number;
  /**
   * Predicate determining whether an error should be retried. By default
   * every thrown error is retried until the policy is exhausted.
   */
  shouldRetryError?: (error: unknown) => boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetry: 3,
  baseDelay: 100,
  maxDelay: 2_000,
  factor: 2,
};

/** Default sleeper: real wall-clock wait. */
export const defaultSleeper: Sleeper = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

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
  readonly sleeper: Sleeper;

  constructor(config: Partial<RetryConfig> = {}, sleeper: Sleeper = defaultSleeper) {
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      factor: DEFAULT_RETRY_CONFIG.factor,
      ...config,
    };
    this.sleeper = sleeper;
  }

  /** Delay in ms before the given (0-indexed) retry attempt. */
  delayFor(attempt: number): number {
    return computeBackoff(this.config, attempt);
  }

  /** Whether a retry should happen after `attempt` failed. */
  canRetry(attempt: number): boolean {
    return shouldRetry(this.config, attempt);
  }

  /** Whether the given error is retryable under this policy. */
  shouldRetryError(error: unknown): boolean {
    const predicate = this.config.shouldRetryError;
    if (predicate === undefined) {
      return true;
    }
    return predicate(error);
  }

  /**
   * Execute `operation` under this retry policy. Returns the first
   * successful result. If the operation throws a non-retryable error or
   * the policy is exhausted, rethrows the last error.
   *
   * Deterministic delays: the schedule is fixed by `config`. The
   * injectable `sleeper` lets tests run instantly.
   */
  async run<T>(operation: (attempt: number) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetry; attempt += 1) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;
        if (!this.shouldRetryError(error) || !this.canRetry(attempt)) {
          throw error;
        }
        await this.sleeper(this.delayFor(attempt));
      }
    }
    // Unreachable: loop body always either returns or throws, but TS
    // can't infer that, so we rethrow to satisfy the return type.
    throw lastError;
  }
}
