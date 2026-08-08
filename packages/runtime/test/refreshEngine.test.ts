import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type {
  DataProvider,
  ProviderFetch,
  RawProject,
  RawEvidence,
  RawNarrative,
} from "@insight/data";
import type { RuntimeOptions, RuntimeResult, RuntimeSummary } from "@insight/runtime";
import { RefreshEngine, createRefreshEngine, DEFAULT_REFRESH_OPTIONS } from "@insight/runtime";
import { Scheduler } from "@insight/runtime";
import type { KnowledgeGraph, EntityIndex, AdjacencyIndex, Relationship } from "@insight/knowledge";
import type { Report, ReportLens } from "@insight/core";

// Mock provider that returns predictable data
function createMockProvider(
  id: string,
  name: string,
  projects: RawProject[] = [],
  evidence: RawEvidence[] = [],
  narratives: RawNarrative[] = [],
): DataProvider {
  return {
    id,
    name,
    fetchProjects: vi.fn().mockResolvedValue({ data: projects, asOf: "2026-08-08T00:00:00.000Z" }),
    fetchEvidence: vi.fn().mockResolvedValue({ data: evidence, asOf: "2026-08-08T00:00:00.000Z" }),
    fetchNarratives: vi
      .fn()
      .mockResolvedValue({ data: narratives, asOf: "2026-08-08T00:00:00.000Z" }),
    health: vi.fn().mockResolvedValue({ id, name, available: true, note: "test provider" }),
  };
}

function createMockKnowledgeGraph(): KnowledgeGraph {
  return {
    entities: new Map() as EntityIndex,
    adjacency: new Map() as AdjacencyIndex,
    relationships: [] as readonly Relationship[],
  };
}

function createMockReport(): Report {
  return {
    id: "report-ecosystem",
    lens: "ecosystem" as ReportLens,
    title: "Test Report",
    sections: { thesis: "thesis", catalyst: "catalyst", risk: "risk" },
    evidenceIds: [],
    confidence: "medium",
    generatedAt: "2026-08-08",
    isDemo: true,
  };
}

function createMockSummary(): RuntimeSummary {
  return {
    projectCount: 0,
    narrativeCount: 0,
    evidenceCount: 0,
    graphEntityCount: 0,
    graphRelationshipCount: 0,
  };
}

function createMockResult(): RuntimeResult {
  return {
    projects: [],
    narratives: [],
    evidence: [],
    knowledgeGraph: createMockKnowledgeGraph(),
    report: createMockReport(),
    summary: createMockSummary(),
    timestamp: "2026-08-08T00:00:00.000Z",
  };
}

describe("RefreshEngine", () => {
  let scheduler: Scheduler;
  let providers: Map<string, DataProvider>;
  let defaultOptions: RuntimeOptions;

  beforeEach(() => {
    scheduler = new Scheduler();
    providers = new Map([
      [
        "coingecko",
        createMockProvider("coingecko", "CoinGecko", [
          { id: "btc", name: "Bitcoin", category: "crypto" },
        ]),
      ],
      [
        "defillama",
        createMockProvider("defillama", "DefiLlama", [
          { id: "uniswap", name: "Uniswap", category: "defi" },
        ]),
      ],
    ]);
    defaultOptions = {
      referenceDate: "2026-08-08",
      lens: "ecosystem",
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a RefreshEngine with default config", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    expect(engine.getJobId()).toBe("insight-data-refresh");
    expect(engine.getJobName()).toBe("Insight Data Refresh");
    expect(engine.isEnabled()).toBe(true);
    expect(engine.getStats().isRunning).toBe(false);
  });

  it("registers the refresh job with the scheduler", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    const job = scheduler.get("insight-data-refresh");
    expect(job).toBeDefined();
    expect(job?.id).toBe("insight-data-refresh");
    expect(job?.enabled).toBe(true);
    expect(job?.tags).toContain("data-refresh");
  });

  it("does not auto-register when autoRegister is false", () => {
    new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: false,
    });

    const job = scheduler.get("insight-data-refresh");
    expect(job).toBeUndefined();
  });

  it("uses custom job ID and name", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      jobId: "custom-refresh",
      jobName: "Custom Refresh",
    });

    expect(engine.getJobId()).toBe("custom-refresh");
    expect(engine.getJobName()).toBe("Custom Refresh");
    expect(scheduler.get("custom-refresh")).toBeDefined();
  });

  it("uses custom cron expression", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      cronExpression: "0 0 * * *", // daily
    });

    const job = scheduler.get("insight-data-refresh");
    expect(job?.cron).toBe("0 0 * * *");
  });

  it("executeRefresh returns success with result", async () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: false,
    });

    // Mock the runtime.analyze to return a result
    const mockResult = createMockResult();

    const runtime = engine.getRuntime();
    vi.spyOn(runtime, "analyze").mockReturnValue(mockResult);

    const result = await engine.executeRefresh();

    expect(result.success).toBe(true);
    expect(result.result).toEqual(mockResult);
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("executeRefresh handles concurrent execution guard", async () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: false,
    });

    // Start first execution (don't await)
    const promise1 = engine.executeRefresh();

    // Try second execution immediately
    const result2 = await engine.executeRefresh();

    expect(result2.success).toBe(false);
    expect(result2.error).toBe("Refresh already in progress");

    await promise1; // clean up
  });

  it("triggerRefresh calls executeRefresh", async () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: false,
    });

    const mockResult = createMockResult();

    vi.spyOn(engine.getRuntime(), "analyze").mockReturnValue(mockResult);

    const result = await engine.triggerRefresh({ lens: "defi" });

    expect(result.success).toBe(true);
    expect(result.result).toEqual(mockResult);
  });

  it("setEnabled toggles job enabled state", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    expect(engine.isEnabled()).toBe(true);

    engine.setEnabled(false);
    expect(engine.isEnabled()).toBe(false);

    engine.setEnabled(true);
    expect(engine.isEnabled()).toBe(true);
  });

  it("unregister removes job from scheduler", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    expect(scheduler.get("insight-data-refresh")).toBeDefined();

    engine.unregister();

    expect(scheduler.get("insight-data-refresh")).toBeUndefined();
  });

  it("clearHistory clears execution history", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    // Execute a refresh via scheduler to generate execution history
    const mockResult = createMockResult();

    vi.spyOn(engine.getRuntime(), "analyze").mockReturnValue(mockResult);

    return engine
      .getScheduler()
      .execute(engine.getJobId())
      .then(() => {
        expect(engine.getStats().totalExecutions).toBe(1);

        engine.clearHistory();

        expect(engine.getStats().totalExecutions).toBe(0);
      });
  });

  it("getStats returns correct stats", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    const stats = engine.getStats();

    expect(stats.totalExecutions).toBe(0);
    expect(stats.successfulExecutions).toBe(0);
    expect(stats.failedExecutions).toBe(0);
    expect(stats.lastExecution).toBeUndefined();
    expect(stats.lastSuccessfulResult).toBeUndefined();
    expect(stats.isRunning).toBe(false);
  });

  it("getCollector returns the evidence collector", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    const collector = engine.getCollector();
    expect(collector).toBeDefined();
    expect(typeof collector.collect).toBe("function");
  });

  it("getRuntime returns the insight runtime", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    const runtime = engine.getRuntime();
    expect(runtime).toBeDefined();
    expect(typeof runtime.analyze).toBe("function");
  });

  it("getScheduler returns the scheduler", () => {
    const engine = new RefreshEngine({
      providers,
      defaultRuntimeOptions: defaultOptions,
      scheduler,
      autoRegister: true,
    });

    const returnedScheduler = engine.getScheduler();
    expect(returnedScheduler).toBe(scheduler);
  });
});

describe("createRefreshEngine factory", () => {
  it("creates engine with provided config", () => {
    const scheduler = new Scheduler();
    const providers = new Map([["test", createMockProvider("test", "Test Provider")]]);
    const defaultOptions: RuntimeOptions = {
      referenceDate: "2026-08-08",
      lens: "ecosystem",
    };

    const engine = createRefreshEngine(providers, defaultOptions, {
      jobId: "factory-job",
      autoRegister: true,
    });

    expect(engine.getJobId()).toBe("factory-job");
    expect(engine.isEnabled()).toBe(true);
  });
});

describe("DEFAULT_REFRESH_OPTIONS", () => {
  it("has valid structure", () => {
    expect(DEFAULT_REFRESH_OPTIONS).toBeDefined();
    expect(typeof DEFAULT_REFRESH_OPTIONS.referenceDate).toBe("string");
    expect(DEFAULT_REFRESH_OPTIONS.referenceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DEFAULT_REFRESH_OPTIONS.lens).toBe("ecosystem");
  });
});
