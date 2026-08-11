/**
 * M26 — Infrastructure / database & worker migration tests.
 *
 * All tests run against in-memory/fake adapters (never real Postgres/Redis/
 * S3), exercising the @insight/infra contracts end-to-end with zero external
 * infrastructure. Focus:
 *   1. PostgresSnapshotRepository satisfies the AsyncSnapshotRepository contract
 *   2. KvCache preserves TTL/set/get/has semantics
 *   3. ObjectStore put/get/exists/delete round-trip
 *   4. Worker loop runs and stops on abort signal
 *   5. Config/env resolution + assembleInfra wiring
 */

import {
  PostgresSnapshotRepository,
  assembleInfra,
  InMemorySqlClient,
  resolveInfraConfig,
  isInMemory,
  InMemoryKvBackend,
  KvCache,
  InMemoryObjectStore,
  runWorkerLoop,
} from "../src/index";
import type { Snapshot } from "@insight/runtime";
import { describe, it, expect } from "vitest";

/** Build a minimal valid Snapshot stub for persistence round-trips. */
function makeSnapshot(id: string): Snapshot {
  return {
    id,
    referenceDate: "2026-01-01T00:00:00.000Z",
    options: { referenceDate: "2026-01-01T00:00:00.000Z" },
    summary: { projects: 1, narratives: 1, evidence: 1 },
    projects: [],
    narratives: [],
    evidence: [],
    report: undefined as never,
    knowledgeGraph: {},
  } as Snapshot;
}

/* ── Postgres repository (via in-memory SQL client) ────────────────── */

describe("PostgresSnapshotRepository", () => {
  it("persists and reads snapshots through the AsyncSnapshotRepository contract", async () => {
    const repo = new PostgresSnapshotRepository(new InMemorySqlClient());
    await repo.initialize();

    const snap = makeSnapshot("snapshot-2026-01-01-abc123");
    const saved = await repo.save(snap);
    expect(saved.id).toBe(snap.id);

    const got = await repo.get(snap.id);
    expect(got?.id).toBe(snap.id);
    expect(await repo.count()).toBe(1);
  });

  it("lists, deletes, and clears", async () => {
    const repo = new PostgresSnapshotRepository(new InMemorySqlClient());
    await repo.initialize();
    await repo.save(makeSnapshot("a"));
    await repo.save(makeSnapshot("b"));
    expect((await repo.list()).length).toBe(2);

    expect(await repo.delete("a")).toBe(true);
    expect(await repo.delete("a")).toBe(false);
    expect((await repo.list()).length).toBe(1);

    await repo.clear();
    expect(await repo.count()).toBe(0);
  });
});

/* ── 2. KV cache semantics ─────────────────────────────────────────── */

describe("KvCache", () => {
  it("stores and reads values with TTL", async () => {
    const backend = new InMemoryKvBackend(() => 1000);
    const cache = new KvCache({ backend, defaultTtlMs: 5000 });
    await cache.set("a", { hello: "world" });
    expect(await cache.get("a")).toEqual({ hello: "world" });
    expect(await cache.has("a")).toBe(true);
  });

  it("expires after the clock advances past TTL", async () => {
    let now = 0;
    const backend = new InMemoryKvBackend(() => now);
    const cache = new KvCache({ backend, defaultTtlMs: 100 });
    await cache.set("a", "value");
    now = 200;
    expect(await cache.has("a")).toBe(false);
    expect(await cache.get("a")).toBeUndefined();
  });

  it("delete removes the key", async () => {
    const cache = new KvCache({});
    await cache.set("a", 1);
    await cache.delete("a");
    expect(await cache.has("a")).toBe(false);
  });
});

/* ── 3. Object store round-trip ────────────────────────────────────── */

describe("InMemoryObjectStore", () => {
  it("put/get/exists/delete round-trip", async () => {
    const store = new InMemoryObjectStore();
    const body = new TextEncoder().encode("report-artifact");
    await store.put({ key: "r1/report.md", body, contentType: "text/markdown" });
    expect(await store.exists("r1/report.md")).toBe(true);
    const read = await store.get("r1/report.md");
    expect(read).toEqual(body);
    expect(await store.delete("r1/report.md")).toBe(true);
    expect(await store.exists("r1/report.md")).toBe(false);
  });
});

/* ── 4. Worker loop ────────────────────────────────────────────────── */

describe("runWorkerLoop", () => {
  it("runs one iteration then stops on abort", async () => {
    const controller = new AbortController();
    const logs: string[] = [];
    const promise = runWorkerLoop(
      {
        name: "test",
        async handle({ attempt }) {
          logs.push(`run-${attempt}`);
          controller.abort(); // stop after first iteration
          return "ok";
        },
      },
      { signal: controller.signal, log: (l) => logs.push(l) },
    );
    const result = await promise;
    expect(result.runs).toBeGreaterThanOrEqual(1);
    expect(logs.length).toBeGreaterThan(0);
  });

  it("stops after the failure cap", async () => {
    const controller = new AbortController();
    const result = await runWorkerLoop(
      {
        name: "failing",
        intervalMs: 1,
        maxFailures: 2,
        async handle() {
          throw new Error("boom");
        },
      },
      { signal: controller.signal, log: () => undefined },
    );
    expect(result.failures).toBe(2);
    expect(result.runs).toBe(0);
  });
});

/* ── 5. Config + assembly ──────────────────────────────────────────── */

describe("config + assembly", () => {
  it("is in-memory when no external endpoints are configured", () => {
    const config = resolveInfraConfig({});
    expect(isInMemory(config)).toBe(true);
  });

  it("detects external endpoints when configured", () => {
    const config = resolveInfraConfig({
      INSIGHT_POSTGRES_URL: "postgresql://x",
      INSIGHT_REDIS_URL: "redis://x",
    });
    expect(isInMemory(config)).toBe(false);
  });

  it("assembles services with an in-memory fallback", () => {
    const config = resolveInfraConfig({});
    const services = assembleInfra({ config });
    expect(services.inMemory).toBe(true);
    expect(services.snapshotRepository).toBeInstanceOf(PostgresSnapshotRepository);
    expect(services.cache).toBeInstanceOf(KvCache);
    expect(services.objectStore).toBeInstanceOf(InMemoryObjectStore);
  });
});
