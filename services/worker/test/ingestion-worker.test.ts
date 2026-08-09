import { describe, expect, it } from "vitest";
import type { DataProvider, RawProject, RawEvidence, RawNarrative } from "@insight/data";
import { createIngestionWorkerSpec } from "../src/index";

/** Deterministic mock provider that returns empty data — no network. */
function createEmptyMockProvider(id: string, name: string): DataProvider {
  return {
    id,
    name,
    fetchProjects: async () => ({ data: [] as RawProject[], asOf: "2026-08-09T00:00:00.000Z" }),
    fetchEvidence: async () => ({ data: [] as RawEvidence[], asOf: "2026-08-09T00:00:00.000Z" }),
    fetchNarratives: async () => ({ data: [] as RawNarrative[], asOf: "2026-08-09T00:00:00.000Z" }),
    health: async () => ({ id, name, available: true, note: "mock" }),
  };
}

describe("createIngestionWorkerSpec", () => {
  it("builds a worker spec with the correct name", () => {
    const { spec } = createIngestionWorkerSpec({
      providers: [createEmptyMockProvider("test-a", "Test A")],
    });
    expect(spec.name).toBe("insight-ingestion");
  });

  it("uses a custom interval when provided", () => {
    const { spec } = createIngestionWorkerSpec({
      providers: [createEmptyMockProvider("test-b", "Test B")],
      intervalMs: 60_000,
    });
    expect(spec.intervalMs).toBe(60_000);
  });

  it("uses default maxFailures when not specified", () => {
    const { spec } = createIngestionWorkerSpec({
      providers: [createEmptyMockProvider("test-c", "Test C")],
    });
    expect(spec.maxFailures).toBe(10);
  });

  it("accepts custom maxFailures", () => {
    const { spec } = createIngestionWorkerSpec({
      providers: [createEmptyMockProvider("test-d", "Test D")],
      maxFailures: 3,
    });
    expect(spec.maxFailures).toBe(3);
  });

  it("exposes provider names in order", () => {
    const { providers } = createIngestionWorkerSpec({
      providers: [
        createEmptyMockProvider("alpha", "Alpha"),
        createEmptyMockProvider("beta", "Beta"),
      ],
    });
    expect(providers).toEqual(["alpha", "beta"]);
  });

  it("builds a RefreshEngine instance", () => {
    const { engine } = createIngestionWorkerSpec({
      providers: [createEmptyMockProvider("test-e", "Test E")],
    });
    expect(engine.getJobId()).toBe("insight-data-refresh");
    expect(engine.getJobName()).toBe("Insight Data Refresh");
  });

  it("the worker spec handle executes a refresh cycle", async () => {
    const { spec, engine } = createIngestionWorkerSpec({
      providers: [createEmptyMockProvider("test-f", "Test F")],
    });
    expect(engine.isEnabled()).toBe(true);

    // executeRefresh should complete (may produce demo data)
    const result = await engine.triggerRefresh();
    // The refresh should either succeed or fail gracefully
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("startedAt");
    expect(result).toHaveProperty("completedAt");
  });
});
