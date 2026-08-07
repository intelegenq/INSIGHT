import { describe, expect, it } from "vitest";
import {
  RetryPolicy,
  computeBackoff,
  retrySchedule,
  shouldRetry,
} from "../src/providers/base/RetryPolicy";

describe("RetryPolicy", () => {
  it("computes exponential backoff deterministically", () => {
    expect(computeBackoff({ maxRetry: 3, baseDelay: 100, maxDelay: 1000 }, 0)).toBe(100);
    expect(computeBackoff({ maxRetry: 3, baseDelay: 100, maxDelay: 1000 }, 1)).toBe(200);
    expect(computeBackoff({ maxRetry: 3, baseDelay: 100, maxDelay: 1000 }, 2)).toBe(400);
  });

  it("caps delays at maxDelay", () => {
    expect(computeBackoff({ maxRetry: 5, baseDelay: 100, maxDelay: 300 }, 4)).toBe(300);
  });

  it("honors a custom factor", () => {
    expect(computeBackoff({ maxRetry: 3, baseDelay: 100, maxDelay: 1000, factor: 3 }, 1)).toBe(300);
  });

  it("treats negative attempts as zero delay", () => {
    expect(computeBackoff({ maxRetry: 3, baseDelay: 100, maxDelay: 1000 }, -1)).toBe(0);
  });

  it("decides whether to retry based on maxRetry", () => {
    expect(shouldRetry({ maxRetry: 3, baseDelay: 100, maxDelay: 1000 }, 0)).toBe(true);
    expect(shouldRetry({ maxRetry: 3, baseDelay: 100, maxDelay: 1000 }, 2)).toBe(true);
    expect(shouldRetry({ maxRetry: 3, baseDelay: 100, maxDelay: 1000 }, 3)).toBe(false);
  });

  it("produces a deterministic full schedule", () => {
    expect(retrySchedule({ maxRetry: 3, baseDelay: 100, maxDelay: 1000 })).toEqual([100, 200, 400]);
  });

  it("exposes policy helpers", () => {
    const policy = new RetryPolicy({ maxRetry: 2, baseDelay: 50, maxDelay: 500 });

    expect(policy.delayFor(0)).toBe(50);
    expect(policy.delayFor(1)).toBe(100);
    expect(policy.canRetry(0)).toBe(true);
    expect(policy.canRetry(2)).toBe(false);
  });
});
