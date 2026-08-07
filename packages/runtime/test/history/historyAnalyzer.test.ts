import { describe, expect, it } from "vitest";
import { HistoryAnalyzer } from "../../src/history/HistoryAnalyzer";
import { createSnapshot } from "../../src/snapshot";
import type { Snapshot } from "../../src/snapshot";
import type {
  Evidence,
  Narrative,
  Project,
  Report,
} from "@insight/core";
import type { KnowledgeGraph } from "@insight/knowledge";

function makeProject(
  id: string,
  partial: Partial<Project> = {},
): Project {
  return {
    id,
    name: id,
    category: "defi",
    description: `${id} description`,
    metrics: { tvl: 1_000_000 },
    evidenceIds: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function makeNarrative(id: string, trend: Narrative["trend"], note: string): Narrative {
  return {
    id,
    name: id,
    trend,
    note,
    projectIds: [],
    evidenceIds: [],
  };
}

function makeEvidence(id: string): Evidence {
  return {
    id,
    source: { id: `src-${id}`, name: `Source ${id}` },
    note: `note-${id}`,
    status: "verified",
    observedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeReport(): Report {
  return {
    id: "report",
    lens: "ecosystem",
    title: "t",
    sections: { thesis: "t" },
    evidenceIds: [],
    confidence: "illustrative",
    generatedAt: "2026-01-01T00:00:00.000Z",
    isDemo: true,
  };
}

function makeSnapshot(
  referenceDate: string,
  projects: Project[],
  narratives: Narrative[],
): Snapshot {
  const evidence = projects.flatMap((p) => p.evidenceIds.map((id) => makeEvidence(id)));
  return createSnapshot({
    referenceDate,
    options: { referenceDate },
    summary: {
      projectCount: projects.length,
      narrativeCount: narratives.length,
      evidenceCount: evidence.length,
      graphEntityCount: 0,
      graphRelationshipCount: 0,
    },
    projects,
    narratives,
    evidence,
    report: makeReport(),
    knowledgeGraph: { entities: new Map(), adjacency: new Map(), relationships: [] },
  });
}

describe("HistoryAnalyzer", () => {
  const analyzer = new HistoryAnalyzer();

  it("identical snapshots produce empty changes", () => {
    const snap = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [makeProject("p1", { metrics: { tvl: 1_000_000 } })],
      [makeNarrative("n1", "flat", "stable")],
    );
    const diff = analyzer.compare(snap, snap);
    expect(diff.projects).toEqual([]);
    expect(diff.narratives).toEqual([]);
    expect(diff.summary.changedProjects).toBe(0);
    expect(diff.summary.changedNarratives).toBe(0);
  });

  it("detects a project metric increase", () => {
    const older = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [makeProject("alpha", { metrics: { tvl: 1_000_000 } })],
      [],
    );
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [makeProject("alpha", { metrics: { tvl: 1_100_000 } })],
      [],
    );
    const diff = analyzer.compare(older, newer);
    expect(diff.projects).toHaveLength(1);
    const change = diff.projects[0];
    if (!change) throw new Error("expected change");
    expect(change.projectId).toBe("alpha");
    expect(change.metrics).toHaveLength(1);
    const metric = change.metrics[0];
    if (!metric) throw new Error("expected metric");
    expect(metric.metric).toBe("tvl");
    expect(metric.from).toBe(1_000_000);
    expect(metric.to).toBe(1_100_000);
    expect(metric.delta).toBe(100_000);
    expect(metric.direction).toBe("increased");
  });

  it("detects multiple metric changes on the same project", () => {
    const older = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [makeProject("alpha", { metrics: { tvl: 1_000_000, volume24h: 500_000 } })],
      [],
    );
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [makeProject("alpha", { metrics: { tvl: 900_000, volume24h: 600_000 } })],
      [],
    );
    const diff = analyzer.compare(older, newer);
    const change = diff.projects[0];
    if (!change) throw new Error("expected change");
    expect(change.metrics).toHaveLength(2);
    const tvlChange = change.metrics.find((m) => m.metric === "tvl");
    const volChange = change.metrics.find((m) => m.metric === "volume24h");
    expect(tvlChange?.direction).toBe("decreased");
    expect(tvlChange?.delta).toBe(-100_000);
    expect(volChange?.direction).toBe("increased");
    expect(volChange?.delta).toBe(100_000);
  });

  it("detects description changes", () => {
    const older = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [makeProject("alpha", { description: "old desc" })],
      [],
    );
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [makeProject("alpha", { description: "new desc" })],
      [],
    );
    const diff = analyzer.compare(older, newer);
    expect(diff.projects[0]?.descriptionChanged).toBe(true);
  });

  it("summarizes added and removed projects", () => {
    const older = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [makeProject("alpha"), makeProject("beta")],
      [],
    );
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [makeProject("alpha"), makeProject("gamma")],
      [],
    );
    const diff = analyzer.compare(older, newer);
    expect(diff.summary.addedProjects).toBe(1);
    expect(diff.summary.removedProjects).toBe(1);
    expect(diff.summary.commonProjects).toBe(1);
  });

  it("detects narrative trend shifts", () => {
    const older = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [],
      [makeNarrative("n1", "down", "cooling off")],
    );
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [],
      [makeNarrative("n1", "up", "heating up")],
    );
    const diff = analyzer.compare(older, newer);
    expect(diff.narratives).toHaveLength(1);
    const change = diff.narratives[0];
    if (!change) throw new Error("expected narrative change");
    expect(change.fromTrend).toBe("down");
    expect(change.toTrend).toBe("up");
    expect(change.trendChange).toBe("trend-shifted");
    expect(change.noteChanged).toBe(true);
  });

  it("marks narratives as appeared when only present in newer snapshot", () => {
    const older = makeSnapshot("2026-01-01T00:00:00.000Z", [], []);
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [],
      [makeNarrative("n1", "up", "fresh narrative")],
    );
    const diff = analyzer.compare(older, newer);
    const change = diff.narratives[0];
    if (!change) throw new Error("expected narrative change");
    expect(change.trendChange).toBe("appeared");
    expect(change.fromTrend).toBeUndefined();
    expect(change.toTrend).toBe("up");
  });

  it("orders project and narrative changes by id (stable sort)", () => {
    const older = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [
        makeProject("zeta", { metrics: { tvl: 1 } }),
        makeProject("alpha", { metrics: { tvl: 1 } }),
        makeProject("mu", { metrics: { tvl: 1 } }),
      ],
      [
        makeNarrative("zeta", "flat", "a"),
        makeNarrative("alpha", "flat", "b"),
      ],
    );
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [
        makeProject("zeta", { metrics: { tvl: 2 } }),
        makeProject("alpha", { metrics: { tvl: 2 } }),
        makeProject("mu", { metrics: { tvl: 2 } }),
      ],
      [
        makeNarrative("zeta", "flat", "a2"),
        makeNarrative("alpha", "flat", "b2"),
      ],
    );
    const diff = analyzer.compare(older, newer);
    expect(diff.projects.map((p) => p.projectId)).toEqual(["alpha", "mu", "zeta"]);
    expect(diff.narratives.map((n) => n.narrativeId)).toEqual(["alpha", "zeta"]);
  });

  it("is deterministic — same inputs produce identical output across many runs", () => {
    const older = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [makeProject("p1", { metrics: { tvl: 1_000 } })],
      [makeNarrative("n1", "down", "a")],
    );
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [makeProject("p1", { metrics: { tvl: 2_000 } })],
      [makeNarrative("n1", "up", "b")],
    );
    const first = JSON.stringify(analyzer.compare(older, newer));
    for (let i = 0; i < 25; i += 1) {
      const next = JSON.stringify(analyzer.compare(older, newer));
      expect(next).toBe(first);
    }
  });

  it("does not emit changes when only metadata fields differ but no metric or trend changes", () => {
    const older = makeSnapshot(
      "2026-01-01T00:00:00.000Z",
      [makeProject("alpha", { description: "same", metrics: { tvl: 1_000 } })],
      [makeNarrative("n1", "flat", "same")],
    );
    const newer = makeSnapshot(
      "2026-01-02T00:00:00.000Z",
      [makeProject("alpha", { description: "same", metrics: { tvl: 1_000 } })],
      [makeNarrative("n1", "flat", "same")],
    );
    const diff = analyzer.compare(older, newer);
    expect(diff.projects).toEqual([]);
    expect(diff.narratives).toEqual([]);
  });
});