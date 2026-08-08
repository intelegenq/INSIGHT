import { describe, expect, it, vi, beforeEach } from "vitest";
import { SourceHealthMonitor } from "../../src/evidence/SourceHealthMonitor";
import type { DataProvider, ProviderHealth } from "../../src/interfaces/DataProvider";

function createMockProvider(
  name: string,
  healthResult: ProviderHealth,
  shouldFail = false,
  delay = 0,
): DataProvider {
  return {
    id: name,
    name: name,
    async health() {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (shouldFail) throw new Error(`${name} health check failed`);
      return healthResult;
    },
    async fetchProjects() {
      return { data: [], asOf: new Date().toISOString() };
    },
    async fetchEvidence() {
      return { data: [], asOf: new Date().toISOString() };
    },
    async fetchNarratives() {
      return { data: [], asOf: new Date().toISOString() };
    },
  };
}

describe("SourceHealthMonitor", () => {
  let monitor: SourceHealthMonitor;

  beforeEach(() => {
    monitor = new SourceHealthMonitor();
  });

  it("adds and removes providers", () => {
    const provider = createMockProvider("test", { id: "test", name: "Test", available: true });
    monitor.addProvider("test", provider);
    expect(monitor.getProviderNames()).toEqual(["test"]);

    monitor.removeProvider("test");
    expect(monitor.getProviderNames()).toEqual([]);
  });

  it("checks all providers and returns healthy status", async () => {
    const provider = createMockProvider("healthy", {
      id: "healthy",
      name: "Healthy",
      available: true,
    });
    monitor.addProvider("healthy", provider);

    const result = await monitor.checkAll();

    expect(result.providers).toHaveLength(1);
    expect(result.providers[0]?.available).toBe(true);
    expect(result.summary.total).toBe(1);
    expect(result.summary.healthy).toBe(1);
    expect(result.summary.unhealthy).toBe(0);
    expect(result.summary.checkedAt).toBeDefined();
    expect(result.summary.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("reports unhealthy provider when health check fails", async () => {
    const provider = createMockProvider("unhealthy", {
      id: "unhealthy",
      name: "Unhealthy",
      available: false,
      note: "down",
    });
    monitor.addProvider("unhealthy", provider);

    const result = await monitor.checkAll();

    expect(result.providers[0]?.available).toBe(false);
    expect(result.summary.healthy).toBe(0);
    expect(result.summary.unhealthy).toBe(1);
  });

  it("handles provider throwing error", async () => {
    const provider = createMockProvider(
      "throwing",
      { id: "throwing", name: "Throwing", available: true },
      true,
    );
    monitor.addProvider("throwing", provider);

    const result = await monitor.checkAll();

    expect(result.providers[0]?.available).toBe(false);
    expect(result.providers[0]?.note).toContain("health check failed");
    expect(result.summary.unhealthy).toBe(1);
  });

  it("handles provider timeout", async () => {
    const provider = createMockProvider(
      "slow",
      { id: "slow", name: "Slow", available: true },
      false,
      100,
    );
    monitor.addProvider("slow", provider);

    // Very short timeout to force timeout
    const fastMonitor = new SourceHealthMonitor(new Map([["slow", provider]]), { timeoutMs: 10 });
    const result = await fastMonitor.checkAll();

    expect(result.providers[0]?.available).toBe(false);
    expect(result.providers[0]?.note).toContain("timeout");
    expect(result.summary.unhealthy).toBe(1);
  });

  it("checks single provider", async () => {
    const provider = createMockProvider("single", {
      id: "single",
      name: "Single",
      available: true,
      note: "ok",
    });
    monitor.addProvider("single", provider);

    const record = await monitor.checkProvider("single");

    expect(record).toBeDefined();
    expect(record?.id).toBe("single");
    expect(record?.available).toBe(true);
    expect(record?.note).toBe("ok");
    expect(record?.checkedAt).toBeDefined();
    expect(record?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns undefined for unknown provider", async () => {
    const record = await monitor.checkProvider("unknown");
    expect(record).toBeUndefined();
  });

  it("tracks health history", async () => {
    const provider = createMockProvider("history", {
      id: "history",
      name: "History",
      available: true,
    });
    monitor.addProvider("history", provider);

    await monitor.checkAll();
    await monitor.checkAll();

    const history = monitor.getHealthHistory("history");
    expect(history).toHaveLength(2);
  });

  it("clears history", async () => {
    const provider = createMockProvider("clear", { id: "clear", name: "Clear", available: true });
    monitor.addProvider("clear", provider);

    await monitor.checkAll();
    expect(monitor.getHealthHistory("clear")).toHaveLength(1);

    monitor.clearHistory();
    expect(monitor.getHealthHistory("clear")).toHaveLength(0);
  });

  it("returns latest health for provider", async () => {
    const provider = createMockProvider("latest", {
      id: "latest",
      name: "Latest",
      available: true,
    });
    monitor.addProvider("latest", provider);

    await monitor.checkAll();
    const latest = monitor.getLatestHealth("latest");

    expect(latest).toBeDefined();
    expect(latest?.id).toBe("latest");
  });

  it("returns undefined for provider with no history", () => {
    const latest = monitor.getLatestHealth("nonexistent");
    expect(latest).toBeUndefined();
  });

  it("handles multiple providers", async () => {
    const p1 = createMockProvider("p1", { id: "p1", name: "P1", available: true });
    const p2 = createMockProvider("p2", { id: "p2", name: "P2", available: false, note: "down" });
    const p3 = createMockProvider("p3", { id: "p3", name: "P3", available: true });

    monitor.addProvider("p1", p1);
    monitor.addProvider("p2", p2);
    monitor.addProvider("p3", p3);

    const result = await monitor.checkAll();

    expect(result.providers).toHaveLength(3);
    expect(result.summary.total).toBe(3);
    expect(result.summary.healthy).toBe(2);
    expect(result.summary.unhealthy).toBe(1);
  });
});
