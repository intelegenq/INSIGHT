import { describe, expect, it } from "vitest";
import { InMemorySnapshotRepository } from "../../src/snapshot/InMemorySnapshotRepository";
import { buildSnapshotId, createSnapshot, hashSnapshotContent } from "../../src/snapshot";
import type { Snapshot } from "../../src/snapshot";
import type { RuntimeResult } from "../../src/types";
import type { Evidence, Narrative, Project, Report } from "@insight/core";
import type { KnowledgeGraph } from "@insight/knowledge";

function buildSnapshot(referenceDate: string, suffix: string): Snapshot {
  const projects: Project[] = [
    {
      id: `project-${suffix}`,
      name: `Project ${suffix}`,
      category: "defi",
      description: `Project ${suffix} description`,
      metrics: { tvl: 1_000_000 },
      evidenceIds: [],
      updatedAt: referenceDate,
    },
  ];
  const narratives: Narrative[] = [];
  const evidence: Evidence[] = [];
  const report: Report = {
    id: `report-${suffix}`,
    lens: "ecosystem",
    title: `Report ${suffix}`,
    sections: { thesis: `Thesis ${suffix}` },
    evidenceIds: [],
    confidence: "illustrative",
    generatedAt: referenceDate,
    isDemo: true,
  };
  const knowledgeGraph: KnowledgeGraph = {
    entities: new Map(),
    adjacency: new Map(),
    relationships: [],
  };
  const result: RuntimeResult = {
    projects,
    narratives,
    evidence,
    knowledgeGraph,
    report,
    summary: {
      projectCount: projects.length,
      narrativeCount: narratives.length,
      evidenceCount: evidence.length,
      graphEntityCount: 0,
      graphRelationshipCount: 0,
    },
    timestamp: referenceDate,
  };
  return createSnapshot({
    referenceDate,
    options: { referenceDate },
    summary: result.summary,
    projects,
    narratives,
    evidence,
    report,
    knowledgeGraph,
  });
}

describe("InMemorySnapshotRepository", () => {
  it("saves and retrieves snapshots by id", () => {
    const repo = new InMemorySnapshotRepository();
    const snap = buildSnapshot("2026-01-01T00:00:00.000Z", "a");
    const stored = repo.save(snap);

    expect(stored.id).toBe(snap.id);
    expect(repo.get(snap.id)?.id).toBe(snap.id);
    expect(repo.size).toBe(1);
  });

  it("returns insertion-order list", () => {
    const repo = new InMemorySnapshotRepository();
    const a = buildSnapshot("2026-01-01T00:00:00.000Z", "a");
    const b = buildSnapshot("2026-01-02T00:00:00.000Z", "b");
    const c = buildSnapshot("2026-01-03T00:00:00.000Z", "c");

    repo.save(a);
    repo.save(b);
    repo.save(c);

    const ids = repo.list().map((s) => s.id);
    expect(ids).toEqual([a.id, b.id, c.id]);
  });

  it("removes snapshots and returns true only when present", () => {
    const repo = new InMemorySnapshotRepository();
    const snap = buildSnapshot("2026-01-01T00:00:00.000Z", "a");
    repo.save(snap);

    expect(repo.delete(snap.id)).toBe(true);
    expect(repo.delete(snap.id)).toBe(false);
    expect(repo.size).toBe(0);
  });

  it("clear removes all snapshots", () => {
    const repo = new InMemorySnapshotRepository();
    repo.save(buildSnapshot("2026-01-01T00:00:00.000Z", "a"));
    repo.save(buildSnapshot("2026-01-02T00:00:00.000Z", "b"));
    expect(repo.size).toBe(2);

    repo.clear();
    expect(repo.size).toBe(0);
    expect(repo.list()).toEqual([]);
  });

  it("stored snapshots are immutable", () => {
    const repo = new InMemorySnapshotRepository();
    const snap = buildSnapshot("2026-01-01T00:00:00.000Z", "a");
    const stored = repo.save(snap);

    expect(Object.isFrozen(stored)).toBe(true);
    expect(() => {
      (stored as { id: string }).id = "mutated";
    }).toThrow();
  });

  it("get returns undefined for unknown id", () => {
    const repo = new InMemorySnapshotRepository();
    expect(repo.get("missing")).toBeUndefined();
  });

  it("list returns a fresh array on every call", () => {
    const repo = new InMemorySnapshotRepository();
    const a = buildSnapshot("2026-01-01T00:00:00.000Z", "a");
    repo.save(a);
    const list1 = repo.list();
    const list2 = repo.list();
    expect(list1).not.toBe(list2);
    expect(list1.map((s) => s.id)).toEqual(list2.map((s) => s.id));
  });

  it("delete preserves insertion order of remaining snapshots", () => {
    const repo = new InMemorySnapshotRepository();
    const a = buildSnapshot("2026-01-01T00:00:00.000Z", "a");
    const b = buildSnapshot("2026-01-02T00:00:00.000Z", "b");
    const c = buildSnapshot("2026-01-03T00:00:00.000Z", "c");
    repo.save(a);
    repo.save(b);
    repo.save(c);

    repo.delete(b.id);
    const ids = repo.list().map((s) => s.id);
    expect(ids).toEqual([a.id, c.id]);
  });
});

describe("buildSnapshotId determinism", () => {
  it("is a pure function of referenceDate + contentHash", () => {
    expect(buildSnapshotId("2026-01-01", "abc123")).toBe(buildSnapshotId("2026-01-01", "abc123"));
    expect(buildSnapshotId("2026-01-01", "abc123")).not.toBe(
      buildSnapshotId("2026-01-02", "abc123"),
    );
  });
});

describe("hashSnapshotContent determinism", () => {
  it("ignores key insertion order", () => {
    const a = hashSnapshotContent({
      referenceDate: "2026-01-01",
      options: { referenceDate: "2026-01-01" },
      summary: {
        projectCount: 1,
        narrativeCount: 0,
        evidenceCount: 0,
        graphEntityCount: 0,
        graphRelationshipCount: 0,
      },
      projects: [],
      narratives: [],
      evidence: [],
      report: {
        id: "r",
        lens: "ecosystem",
        title: "t",
        sections: { thesis: "x" },
        evidenceIds: [],
        confidence: "illustrative",
        generatedAt: "2026-01-01",
        isDemo: true,
      },
      knowledgeGraph: { entities: new Map(), adjacency: new Map(), relationships: [] },
    });
    const b = hashSnapshotContent({
      referenceDate: "2026-01-01",
      options: { referenceDate: "2026-01-01" },
      summary: {
        projectCount: 1,
        narrativeCount: 0,
        evidenceCount: 0,
        graphEntityCount: 0,
        graphRelationshipCount: 0,
      },
      projects: [],
      narratives: [],
      evidence: [],
      report: {
        id: "r",
        lens: "ecosystem",
        title: "t",
        sections: { thesis: "x" },
        evidenceIds: [],
        confidence: "illustrative",
        generatedAt: "2026-01-01",
        isDemo: true,
      },
      knowledgeGraph: { entities: new Map(), adjacency: new Map(), relationships: [] },
    });
    expect(a).toBe(b);
  });
});
