/**
 * M27 — Observability, Evaluation & Security Controls tests.
 *
 * All in-memory/no-op sinks — no external infrastructure. Covers:
 *   1. structured logging + metrics (InMemorySink, noopSink, Counter/Gauge)
 *   2. deterministic report/evidence evaluation (builds on core scoring)
 *   3. security: secret redaction, input parsing, authZ, rate limiting
 *   4. resilience: withTimeout + retry
 *   5. WorkerRunner instrumented with a sink
 */

import {
  InMemorySink,
  noopSink,
  Counter,
  Gauge,
  evaluateEvidence,
  evaluateReport,
  meetsVerifiedFloor,
  redactSecrets,
  sanitizeForLog,
  parseInputJson,
  requireNonEmptyString,
  hasScope,
  RateLimiter,
  withTimeout,
  retry,
  TimeoutError,
  runWorkerLoop,
} from "../src/index";
import type { Evidence } from "@insight/core";
import { describe, it, expect } from "vitest";

const evidence = (status: Evidence["status"]): Evidence => ({
  id: `e_${status}`,
  source: { id: "src", name: "Src" },
  note: "note",
  status,
  observedAt: "2026-01-01T00:00:00.000Z",
});

/* ── 1. Observability (logging + metrics) ─────────────────────────── */

describe("observability", () => {
  it("buffers structured log records in InMemorySink", () => {
    const sink = new InMemorySink(() => "2026-01-01T00:00:00.000Z");
    sink.log({ severity: "info", message: "hello", timestamp: "T" });
    const logs = sink.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.message).toBe("hello");
    expect(logs[0]?.timestamp).toBe("T");
  });

  it("injects default timestamp when omitted", () => {
    const sink = new InMemorySink(() => "2026-01-02T00:00:00.000Z");
    sink.log({ severity: "warn", message: "w" });
    expect(sink.getLogs()[0]?.timestamp).toBe("2026-01-02T00:00:00.000Z");
  });

  it("counters emit metrics and gauges track value", () => {
      const sink = new InMemorySink(() => "T");
      const cnt = new Counter("requests", sink);
      cnt.increment();
      cnt.increment(3);
      expect(cnt.current).toBe(4);
      expect(sink.getMetrics().length).toBe(2);
    });

    it("gauge sets an absolute value", () => {
      const sink = new InMemorySink(() => "T");
      const g = new Gauge("up", sink);
      g.set(1);
      expect(g.current).toBe(1);
      g.set(2);
      expect(g.current).toBe(2);
      expect(sink.getMetrics().length).toBe(2);
    });

  it("noop sink discards everything", () => {
    noopSink.log({ severity: "info", message: "x", timestamp: "t" });
    noopSink.metric({ name: "m", delta: 1, timestamp: "t" });
    // No assertions beyond not throwing; satisfies "no-op default".
    expect(true).toBe(true);
  });
});

/* ── 2. Deterministic report/evidence evaluation ──────────────────── */

describe("evaluation", () => {
  it("evaluateEvidence derives verdict from statuses", () => {
    const v = evaluateEvidence([evidence("verified"), evidence("demo")]);
    expect(v.total).toBe(2);
    expect(v.verified).toBe(1);
    expect(v.demo).toBe(1);
    expect(v.weight).toBe(1 + 0.25);
  });

  it("evaluateReport assigns quality by confidence", () => {
    const good = evaluateReport({
      reportId: "r1",
      confidence: "high",
      evidence: [evidence("verified")],
    });
    expect(good.quality).toBe("good");
    expect(good.hasVerifiedEvidence).toBe(true);

    const poor = evaluateReport({
      reportId: "r2",
      confidence: "draft",
      evidence: [evidence("demo")],
    });
    expect(poor.quality).toBe("poor");
  });

  it("meetsVerifiedFloor", () => {
    expect(meetsVerifiedFloor([evidence("verified"), evidence("verified")], 2)).toBe(true);
    expect(meetsVerifiedFloor([evidence("pending")], 1)).toBe(false);
  });
});

/* ── 3. Security: secrets, input parsing, auth, rate limit ────────── */

describe("security", () => {
  it("redacts credentials in strings", () => {
    expect(redactSecrets("key=sk_abcdefghij123456789")).not.toContain("sk_");
    expect(redactSecrets("Bearer abcdef0123456789")).not.toContain("abcdef0123456789");
  });

  it("sanitizes objects before logging", () => {
    const sanitized = sanitizeForLog({ password: "hunter2", ok: 1, nested: { token: "abc" } });
    expect(sanitized).toMatchObject({ password: "[REDACTED]", ok: 1 });
  });

  it("parses JSON with a size cap", () => {
    expect(parseInputJson('{"a":1}')).toEqual({ a: 1 });
    expect(() => parseInputJson("x".repeat(2000), { maxBytes: 100 })).toThrow();
    expect(() => parseInputJson("nope")).toThrow();
  });

  it("validates non-empty strings", () => {
    expect(requireNonEmptyString("  hi  ", "name")).toBe("hi");
    expect(() => requireNonEmptyString("", "name")).toThrow();
  });

  it("checks authorization scope", () => {
    expect(hasScope(["read:reports"], "read:reports")).toBe(true);
    expect(hasScope(["read:reports"], "write:reports")).toBe(false);
  });

  it("rate limits within a window and refills", () => {
    let now = 0;
    const rl = new RateLimiter({ capacity: 2, windowMs: 10_000 }, () => now);
    expect(rl.allow("a")).toBe(true);
    expect(rl.allow("a")).toBe(true);
    expect(rl.allow("a")).toBe(false); // exhausted
    now = 10_000; // window elapsed -> refill
    expect(rl.allow("a")).toBe(true);
  });
});

/* ── 4. Resilience (timeout + retry) ──────────────────────────────── */

describe("resilience", () => {
  it("withTimeout rejects slow operations", async () => {
    await expect(
      withTimeout(() => new Promise((_, reject) => setTimeout(() => reject(new Error("late")), 200)), { timeoutMs: 5 }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("withTimeout resolves fast operations", async () => {
    await expect(withTimeout(async () => 42, { timeoutMs: 100 })).resolves.toBe(42);
  });

  it("retry retries until success", async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("flaky");
        return "ok";
      },
      { maxAttempts: 3, sleeper: async () => undefined },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("retry stops after the cap", async () => {
    await expect(
      retry(async () => {
        throw new Error("nope");
      }, { maxAttempts: 2, sleeper: async () => undefined }),
    ).rejects.toThrow("nope");
  });
});

/* ── 5. WorkerRunner instruments with a sink ──────────────────────── */

describe("worker observability", () => {
  it("emits logs and metrics to an injected sink", async () => {
    const controller = new AbortController();
    const sink = new InMemorySink(() => "2026-01-01T00:00:00.000Z");
    await runWorkerLoop(
      {
        name: "obs",
        async handle() {
          controller.abort();
          return "ok";
        },
      },
      { signal: controller.signal, log: () => undefined, sink },
    );
    expect(sink.getLogs().length).toBeGreaterThan(0);
    expect(sink.getMetrics().some((m) => m.name === "worker.run")).toBe(true);
  });
});