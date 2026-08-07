import { describe, expect, it } from "vitest";
import { InsightRuntime, runtime } from "../src/runtime";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";

describe("InsightRuntime — end-to-end", () => {
  const options = { referenceDate: REFERENCE_DATE };

  it("creates a runtime instance", () => {
    const instance = InsightRuntime.create();
    expect(instance).toBeInstanceOf(InsightRuntime);
  });

  it("produces a complete runtime result", () => {
    const result = runtime.analyze(options);

    expect(result.projects.length).toBeGreaterThan(0);
    expect(result.narratives.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.report).toBeDefined();
    expect(result.knowledgeGraph).toBeDefined();
    expect(result.timestamp).toBe(REFERENCE_DATE);
  });

  it("returns a non-empty knowledge graph with entities and relationships", () => {
    const result = runtime.analyze(options);

    expect(result.knowledgeGraph.entities.size).toBeGreaterThan(0);
    expect(result.knowledgeGraph.relationships.length).toBeGreaterThan(0);
  });

  it("returns the knowledge graph through the dedicated method", () => {
    const graph = runtime.buildKnowledgeGraph(options);

    expect(graph.entities.size).toBeGreaterThan(0);
    expect(graph.relationships.length).toBeGreaterThan(0);
  });

  it("returns a report through the dedicated method", () => {
    const report = runtime.generateReport(options);

    expect(report).toBeDefined();
    expect(report.lens).toBe("ecosystem");
    expect(report.sections.thesis.length).toBeGreaterThan(0);
  });

  it("returns a report for a specific lens", () => {
    const report = runtime.generateReport({ ...options, lens: "defi" });

    expect(report.lens).toBe("defi");
  });

  it("returns a dashboard projection", () => {
    const dashboard = runtime.generateDashboard(options);

    expect(dashboard.projects.length).toBeGreaterThan(0);
    expect(dashboard.narratives.length).toBeGreaterThan(0);
    expect(dashboard.report).toBeDefined();
    expect(dashboard.summary.projectCount).toBe(dashboard.projects.length);
  });

  it("returns a snapshot (same contract as analyze)", () => {
    const snapshot = runtime.generateSnapshot(options);

    expect(snapshot).toEqual(runtime.analyze(options));
  });

  it("is deterministic: running the pipeline twice yields identical output", () => {
    const first = runtime.analyze(options);
    const second = runtime.analyze(options);

    expect(second).toEqual(first);
  });

  it("is deterministic across instances", () => {
    const a = InsightRuntime.create().analyze(options);
    const b = InsightRuntime.create().analyze(options);

    expect(a).toEqual(b);
  });

  it("orders projects and narratives deterministically", () => {
    const result = runtime.analyze(options);

    const projectIds = result.projects.map((p) => p.id);
    expect([...projectIds].sort()).toEqual(projectIds);

    const narrativeIds = result.narratives.map((n) => n.id);
    expect([...narrativeIds].sort()).toEqual(narrativeIds);
  });
});
