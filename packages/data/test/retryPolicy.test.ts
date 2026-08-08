import { describe, expect, it, vi } from "vitest";
import {
  RetryPolicy,
  DEFAULT_RETRY_CONFIG,
  computeBackoff,
  retrySchedule,
  shouldRetry,
  defaultSleeper,
} from "../src/providers/base/RetryPolicy";
import type { Sleeper } from "../src/providers/base/RetryPolicy";

/**
 * Regression tests for the wired-up retry policy.
 *
 * These tests pin down the deterministic backoff schedule and the
 * retry-exhaustion semantics. They use an injected sleeper so the
 * tests are instant.
 */

function instantSleeper(): Sleeper {
  return async () => {
    // No real wait — keep tests fast and deterministic.
  };
}

function recordingSleeper(): { sleeper: Sleeper; delays: number[] } {
  const delays: number[] = [];
  const sleeper: Sleeper = async (ms) => {
    delays.push(ms);
  };
  return { sleeper, delays };
}

describe("RetryPolicy — schedule", () => {
  it("DEFAULT_RETRY_CONFIG retries up to 3 times with 100ms base", () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetry).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.baseDelay).toBe(100);
    expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(2_000);
  });

  it("computeBackoff is exponential with cap", () => {
    const config = { maxRetry: 5, baseDelay: 100, maxDelay: 1_000, factor: 2 };
    expect(computeBackoff(config, 0)).toBe(100);
    expect(computeBackoff(config, 1)).toBe(200);
    expect(computeBackoff(config, 2)).toBe(400);
    expect(computeBackoff(config, 3)).toBe(800);
    expect(computeBackoff(config, 4)).toBe(1_000); // capped
    expect(computeBackoff(config, 10)).toBe(1_000); // still capped
  });

  it("computeBackoff returns 0 for negative attempts", () => {
    expect(computeBackoff(DEFAULT_RETRY_CONFIG, -1)).toBe(0);
  });

  it("shouldRetry returns true while attempts remain", () => {
    const config = { maxRetry: 3, baseDelay: 100, maxDelay: 1_000 };
    expect(shouldRetry(config, 0)).toBe(true);
    expect(shouldRetry(config, 1)).toBe(true);
    expect(shouldRetry(config, 2)).toBe(true);
    expect(shouldRetry(config, 3)).toBe(false);
  });

  it("retrySchedule yields maxRetry entries", () => {
    const schedule = retrySchedule({ maxRetry: 3, baseDelay: 50, maxDelay: 1_000, factor: 2 });
    expect(schedule).toEqual([50, 100, 200]);
  });
});

describe("RetryPolicy.run — execution", () => {
  it("returns the first successful result without retrying", async () => {
    const policy = new RetryPolicy({ maxRetry: 3, baseDelay: 10, maxDelay: 100 }, instantSleeper());
    let calls = 0;
    const result = await policy.run(async () => {
      calls += 1;
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries up to maxRetry times on transient failure", async () => {
    const { sleeper, delays } = recordingSleeper();
    const policy = new RetryPolicy(
      { maxRetry: 3, baseDelay: 100, maxDelay: 1_000, factor: 2 },
      sleeper,
    );
    let calls = 0;
    const result = await policy.run(async (attempt) => {
      calls += 1;
      if (attempt < 2) throw new Error("transient");
      return `ok-on-attempt-${attempt}`;
    });
    expect(result).toBe("ok-on-attempt-2");
    expect(calls).toBe(3);
    expect(delays).toEqual([100, 200]);
  });

  it("throws the last error when the policy is exhausted", async () => {
    const { sleeper } = recordingSleeper();
    const policy = new RetryPolicy({ maxRetry: 2, baseDelay: 10, maxDelay: 100 }, sleeper);
    let calls = 0;
    await expect(
      policy.run(async () => {
        calls += 1;
        throw new Error("never recovers");
      }),
    ).rejects.toThrow("never recovers");
    expect(calls).toBe(3); // initial + 2 retries
  });

  it("does not retry when shouldRetryError returns false", async () => {
    const { sleeper } = recordingSleeper();
    const policy = new RetryPolicy(
      {
        maxRetry: 3,
        baseDelay: 10,
        maxDelay: 100,
        shouldRetryError: (err) => !(err instanceof Error && err.message === "fatal"),
      },
      sleeper,
    );
    let calls = 0;
    await expect(
      policy.run(async () => {
        calls += 1;
        throw new Error("fatal");
      }),
    ).rejects.toThrow("fatal");
    expect(calls).toBe(1);
  });

  it("uses the configured sleeper for delays", async () => {
    const sleeper = vi.fn<Sleeper>(async () => {});
    const policy = new RetryPolicy({ maxRetry: 2, baseDelay: 50, maxDelay: 1_000 }, sleeper);
    await expect(
      policy.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(sleeper).toHaveBeenCalledTimes(2);
    expect(sleeper).toHaveBeenNthCalledWith(1, 50);
    expect(sleeper).toHaveBeenNthCalledWith(2, 100);
  });

  it("defaultSleeper is exported and is a function", () => {
    expect(typeof defaultSleeper).toBe("function");
  });
});

describe("RetryPolicy — canRetry / shouldRetryError / delayFor", () => {
  it("canRetry matches the underlying shouldRetry function", () => {
    const policy = new RetryPolicy({ maxRetry: 2, baseDelay: 10, maxDelay: 100 });
    expect(policy.canRetry(0)).toBe(true);
    expect(policy.canRetry(1)).toBe(true);
    expect(policy.canRetry(2)).toBe(false);
  });

  it("shouldRetryError defaults to always-true", () => {
    const policy = new RetryPolicy();
    expect(policy.shouldRetryError(new Error("any"))).toBe(true);
    expect(policy.shouldRetryError("string")).toBe(true);
    expect(policy.shouldRetryError({ whatever: 1 })).toBe(true);
  });

  it("shouldRetryError delegates to the configured predicate", () => {
    const policy = new RetryPolicy({
      shouldRetryError: (err) => err instanceof TypeError,
    });
    expect(policy.shouldRetryError(new TypeError("x"))).toBe(true);
    expect(policy.shouldRetryError(new Error("x"))).toBe(false);
  });

  it("delayFor returns the per-attempt backoff", () => {
    const policy = new RetryPolicy({ maxRetry: 3, baseDelay: 25, maxDelay: 1_000, factor: 2 });
    expect(policy.delayFor(0)).toBe(25);
    expect(policy.delayFor(1)).toBe(50);
    expect(policy.delayFor(2)).toBe(100);
  });
});
