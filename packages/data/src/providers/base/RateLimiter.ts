/**
 * RateLimiter — a simple token bucket.
 *
 * Deterministic in the sense that it depends only on the injected clock and
 * the number of reservations made. Implemented with zero external
 * dependencies.
 */

export interface RateLimitConfig {
  /** Number of tokens the bucket can hold. */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
}

/** A clock returning milliseconds since epoch (injectable for tests). */
export type Clock = () => number;

/** Result of a token consumption attempt. */
export interface TokensResult {
  allowed: boolean;
  /** Tokens remaining after the attempt. */
  remaining: number;
  /** Approximate delay in ms before enough tokens are available. */
  retryAfterMs: number;
}

/** Validate that a rate limit config is usable. */
export function validateRateLimitConfig(config: RateLimitConfig): RateLimitConfig {
  if (config.capacity <= 0) {
    throw new Error("capacity must be positive");
  }
  if (config.refillPerSecond < 0) {
    throw new Error("refillPerSecond must be non-negative");
  }
  return config;
}

/** Approximate wall-clock. */
export function defaultClock(): number {
  return Date.now();
}

/** Token bucket rate limiter. */
export class RateLimiter {
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly now: Clock;

  private tokens: number;
  private lastRefill: number;

  constructor(config: RateLimitConfig, now: Clock = defaultClock) {
    const validated = validateRateLimitConfig(config);
    this.capacity = validated.capacity;
    this.refillPerSecond = validated.refillPerSecond;
    this.now = now;
    this.tokens = validated.capacity;
    this.lastRefill = this.now();
  }

  /** Refill tokens based on elapsed time. */
  private refill(): void {
    const current = this.now();
    const elapsedSeconds = Math.max(0, (current - this.lastRefill) / 1_000);
    const added = elapsedSeconds * this.refillPerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + added);
    this.lastRefill = current;
  }

  /**
   * Try to consume `count` tokens (defaults to 1).
   * Returns whether the request is allowed and the delay before retry.
   */
  consume(count = 1): TokensResult {
    this.refill();
    if (count <= 0) {
      return { allowed: true, remaining: this.tokens, retryAfterMs: 0 };
    }
    if (this.tokens >= count) {
      this.tokens -= count;
      return { allowed: true, remaining: this.tokens, retryAfterMs: 0 };
    }
    const deficit = count - this.tokens;
    const retryAfterMs =
      this.refillPerSecond <= 0
        ? Number.POSITIVE_INFINITY
        : (deficit / this.refillPerSecond) * 1_000;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  /** Number of tokens currently available. */
  available(): number {
    this.refill();
    return this.tokens;
  }
}
