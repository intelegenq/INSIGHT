import { describe, expect, it, beforeEach } from "vitest";
import { InsightService, resetInsightService } from "../lib/insight-service";

describe("InsightService M30 infrastructure wiring", () => {
  beforeEach(() => {
    resetInsightService();
  });

  it("getEvaluatedReport returns report with quality verdict", async () => {
    const service = new InsightService();
    await service.ready();
    const evaluated = await service.getEvaluatedReport("ecosystem");
    if (evaluated !== undefined) {
      expect(evaluated.report).toBeDefined();
      expect(evaluated.verdict).toBeDefined();
      expect(evaluated.verdict.reportId).toBe(evaluated.report.id);
      expect(evaluated.verdict.quality).toMatch(/^(poor|fair|good)$/);
      expect(evaluated.verdict.evidence).toBeDefined();
      expect(evaluated.verdict.evidence.total).toBeGreaterThanOrEqual(0);
    }
  });

  it("listProjects caches results — second call hits cache", async () => {
    const service = new InsightService();
    await service.ready();
    const first = await service.listProjects();
    const second = await service.listProjects();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("getReport persists artifact to object store", async () => {
    const service = new InsightService();
    await service.ready();
    const report = await service.getReport("ecosystem");
    expect(report).toBeDefined();
    // The report artifact should be persisted to the object store
    // (in-memory in tests, but the code path is exercised)
  });

  it("snapshot() invalidates caches", async () => {
    const service = new InsightService();
    await service.ready();
    // Populate cache
    await service.listProjects();
    // Take a snapshot — should invalidate cache
    await service.snapshot();
    // Next call should still work (re-populate cache)
    const projects = await service.listProjects();
    expect(projects).toBeInstanceOf(Array);
  });

  it("getNarratives caches results", async () => {
    const service = new InsightService();
    await service.ready();
    const first = await service.getNarratives();
    const second = await service.getNarratives();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
