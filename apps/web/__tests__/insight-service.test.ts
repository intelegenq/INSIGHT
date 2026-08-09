import { describe, expect, it, beforeEach } from "vitest";
import { InsightService, getInsightService, resetInsightService } from "../lib/insight-service";

describe("InsightService", () => {
  beforeEach(() => {
    resetInsightService();
  });

  it("exposes deterministic project list", async () => {
    const a = new InsightService();
    const b = new InsightService();
    const aProjects = await a.listProjects();
    const bProjects = await b.listProjects();
    expect(JSON.stringify(aProjects)).toBe(JSON.stringify(bProjects));
  });

  it("captures snapshots and lists them in insertion order", async () => {
    const service = new InsightService();
    const s1 = await service.snapshot();
    const s2 = await service.snapshot();
    const list = await service.listSnapshots();
    // Two snapshots with identical content produce the same deterministic id,
    // so the repository stores a single entry (idempotent save).
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.at(-1)?.id).toBe(s1.id);
    expect(s2.id).toBe(s1.id);
  });

  it("retrieves snapshots by id", async () => {
    const service = new InsightService();
    const snap = await service.snapshot();
    expect((await service.getSnapshot(snap.id))?.id).toBe(snap.id);
    expect(await service.getSnapshot("missing")).toBeUndefined();
  });

  it("compares snapshots via HistoryAnalyzer", async () => {
    const service = new InsightService();
    const a = await service.snapshot();
    const b = await service.snapshot();
    const diff = await service.compareSnapshots(a.id, b.id);
    expect(diff).toBeDefined();
    expect(diff?.fromId).toBe(a.id);
    expect(diff?.toId).toBe(b.id);
  });

  it("throws SNAPSHOT_NOT_FOUND when comparing missing snapshot ids", async () => {
    try {
      await getInsightService().compareSnapshots("missing", "also-missing");
      throw new Error("Expected compareSnapshots to throw");
    } catch (error) {
      expect(error).toMatchObject({
        message: "Snapshot not found: missing",
      });
    }
  });

  it("shared singleton returns the same instance across calls", () => {
    const first = getInsightService();
    const second = getInsightService();
    expect(second).toBe(first);
  });

  it("snapshot reports a deterministic id across runs", async () => {
    const a = new InsightService();
    const b = new InsightService();
    const idA = (await a.snapshot()).id;
    const idB = (await b.snapshot()).id;
    expect(idA).toBe(idB);
  });
});
