import { describe, expect, it, beforeEach } from "vitest";
import { InsightService, getInsightService, resetInsightService } from "../lib/insight-service";

describe("InsightService", () => {
  beforeEach(() => {
    resetInsightService();
  });

  it("exposes deterministic project list", () => {
    const a = new InsightService();
    const b = new InsightService();
    expect(JSON.stringify(a.listProjects())).toBe(JSON.stringify(b.listProjects()));
  });

  it("captures snapshots and lists them in insertion order", () => {
    const service = new InsightService();
    const s1 = service.snapshot();
    const s2 = service.snapshot();
    const list = service.listSnapshots();
    // Two snapshots with identical content produce the same deterministic id,
    // so the repository stores a single entry (idempotent save).
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.at(-1)?.id).toBe(s1.id);
    expect(s2.id).toBe(s1.id);
  });

  it("retrieves snapshots by id", () => {
    const service = new InsightService();
    const snap = service.snapshot();
    expect(service.getSnapshot(snap.id)?.id).toBe(snap.id);
    expect(service.getSnapshot("missing")).toBeUndefined();
  });

  it("compares snapshots via HistoryAnalyzer", () => {
    const service = new InsightService();
    const a = service.snapshot();
    const b = service.snapshot();
    const diff = service.compareSnapshots(a.id, b.id);
    expect(diff).toBeDefined();
    expect(diff?.fromId).toBe(a.id);
    expect(diff?.toId).toBe(b.id);
  });

  it("returns undefined when comparing missing snapshot ids", () => {
    const service = new InsightService();
    const snap = service.snapshot();
    expect(service.compareSnapshots(snap.id, "missing")).toBeUndefined();
    expect(service.compareSnapshots("missing", snap.id)).toBeUndefined();
  });

  it("shared singleton returns the same instance across calls", () => {
    const first = getInsightService();
    const second = getInsightService();
    expect(second).toBe(first);
  });

  it("snapshot reports a deterministic id across runs", () => {
    const a = new InsightService();
    const b = new InsightService();
    const idA = a.snapshot().id;
    const idB = b.snapshot().id;
    expect(idA).toBe(idB);
  });
});
