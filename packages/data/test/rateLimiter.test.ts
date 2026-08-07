import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/providers/base/RateLimiter";

describe("RateLimiter", () => {
  it("allows requests within capacity", () => {
    const limiter = new RateLimiter({ capacity: 3, refillPerSecond: 1 }, () => 0);

    expect(limiter.consume().allowed).toBe(true);
    expect(limiter.consume().allowed).toBe(true);
    expect(limiter.consume().allowed).toBe(true);
    expect(limiter.consume().allowed).toBe(false);
  });

  it("refills tokens over time using the injected clock", () => {
    let now = 0;
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 1 }, () => now);

    expect(limiter.consume().allowed).toBe(true);
    expect(limiter.consume().allowed).toBe(false);

    now = 1_100; // ~1.1s later → 1 token refilled
    expect(limiter.consume().allowed).toBe(true);
  });

  it("reports remaining tokens", () => {
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 0 }, () => 0);

    const first = limiter.consume();
    expect(first.remaining).toBe(1);

    limiter.consume();
    expect(limiter.available()).toBe(0);
  });

  it("returns retry-after for blocked requests", () => {
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 2 }, () => 0);

    limiter.consume();
    const blocked = limiter.consume();

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("rejects invalid configs", () => {
    expect(() => new RateLimiter({ capacity: 0, refillPerSecond: 1 })).toThrow(/capacity/);
  });

  it("allows zero-token consumption without blocking", () => {
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 1 }, () => 0);
    expect(limiter.consume(0).allowed).toBe(true);
  });
});
