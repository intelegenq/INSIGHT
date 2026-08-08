/**
 * @insight/infra/resilience — retry/timeout hardening.
 *
 * Deterministic, testable helpers: `withTimeout` bounds an async operation,
 * `retry` retries with a fixed backoff and a caller predicate. No external
 * infrastructure required; delays are injectable for instant tests.
 */

export interface TimeoutOptions {
  /** Maximum time in ms before the operation is aborted with an error. */
  timeoutMs: number;
  /** Clock used to measure elapsed time (deterministic under test). */
  now?: () => number;
}

/** Run an async operation, rejecting with TimeoutError if it exceeds the budget. */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: TimeoutOptions,
): Promise<T> {
  const timeoutMs = options.timeoutMs;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    operation()
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error instanceof TimeoutError ? error : (error as Error));
      });
  });
}

/** Error raised when an operation exceeds its deadline. */
export class TimeoutError extends Error {
  readonly code = "TIMEOUT";
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export interface RetryOptions {
  /** Max total attempts (including the first). */
  maxAttempts?: number;
  /** Delay before each retry in ms. */
  delayMs?: number;
  /** Sleeper for deterministic tests. */
  sleeper?: (ms: number) => Promise<void>;
  /** Distinct predicate for retry eligibility. */
  shouldRetry?: (error: unknown) => boolean;
}

/** Await a task, retrying with a fixed delay until success or the cap. */
export async function retry<T>(
  operation: () => Promise<T>,
  config: RetryOptions = {},
): Promise<T> {
  const maxAttempts = config.maxAttempts ?? 3;
  const delayMs = config.delayMs ?? 100;
  const shouldRetry = config.shouldRetry ?? (() => true);
  const sleeper = config.sleeper ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = shouldRetry(error);
      if (attempt >= maxAttempts || !retryable) {
        throw error;
      }
      await sleeper(delayMs);
    }
  }
  // Unreachable (loop returns or throws).
  throw lastError;
}