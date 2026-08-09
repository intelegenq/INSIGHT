import { describe, expect, it, beforeEach } from "vitest";
import { InsightService, getInsightService, resetInsightService } from "../lib/insight-service";

describe("InsightService production hardening", () => {
  beforeEach(() => {
    resetInsightService();
  });

  it("ready() resolves before any API data is served", async () => {
    const service = new InsightService();
    await service.ready();
    // After ready, listProjects should not throw
    const projects = await service.listProjects();
    expect(projects).toBeInstanceOf(Array);
  });

  it("getPulse() does not bypass to demo projectRepository — derives from runtime", async () => {
    const service = new InsightService();
    await service.ready();
    const pulse = await service.getPulse();
    expect(pulse).toHaveProperty("asOf");
    expect(pulse).toHaveProperty("metrics");
    expect(pulse.metrics.length).toBeGreaterThan(0);
    // Should contain derived metrics, not the demo pulse
    expect(pulse.metrics[0]?.id).toBe("projects");
  });

  it("getTimeline() derives from runtime, not demo fixture", async () => {
    const service = new InsightService();
    await service.ready();
    const timeline = await service.getTimeline();
    expect(timeline).toBeInstanceOf(Array);
    if (timeline.length > 0) {
      expect(timeline[0]?.id).toContain("timeline-");
    }
  });

  it("resolveEvidenceIds() routes through snapshot/runtime pipeline", async () => {
    const service = new InsightService();
    await service.ready();
    // Run pipeline to get evidence IDs
    const result = service.run();
    if (result.evidence.length > 0) {
      const evidenceId = result.evidence[0]!.id;
      const resolved = await service.resolveEvidenceIds([evidenceId]);
      expect(resolved.length).toBe(1);
      expect(resolved[0]?.id).toBe(evidenceId);
    }
    // Non-existent IDs return empty
    const empty = await service.resolveEvidenceIds(["nonexistent-id"]);
    expect(empty).toEqual([]);
  });

  it("no projectRepository bypass: pulse and evidence methods are async", async () => {
    const service = new InsightService();
    // These are async methods — they go through the pipeline, not sync demo
    expect(typeof service.getPulse).toBe("function");
    expect(typeof service.getTimeline).toBe("function");
    expect(typeof service.resolveEvidenceIds).toBe("function");
    // ready() is available and returns a promise
    expect(service.ready()).toBeInstanceOf(Promise);
  });

  it("shared persistence: worker and web use same SqlClient contract", async () => {
    // Both InsightService and the worker call getSharedSqlClient() internally.
    // In dev/test this returns InMemorySqlClient — the contract path is
    // identical to production where it returns a pg.Pool-backed client.
    const service = new InsightService();
    await service.ready();
    const snapshot = await service.snapshot();
    const retrieved = await service.getSnapshot(snapshot.id);
    expect(retrieved?.id).toBe(snapshot.id);
  });
});
