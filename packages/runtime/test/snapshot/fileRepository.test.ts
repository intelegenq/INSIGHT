import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  FileSnapshotRepository,
  InMemorySnapshotRepository,
  type Snapshot,
  buildSnapshotId,
  hashSnapshotContent,
} from "../../src/snapshot";

/**
 * Tests for the async FileSnapshotRepository. Each test runs against a
 * fresh temporary directory and cleans up afterwards.
 */

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "insight-snapshot-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeSnapshot(referenceDate: string): Snapshot {
  // Build a snapshot with a deterministic id from the content.
  const partial = {
    referenceDate,
    options: { referenceDate },
    summary: {
      projectCount: 1,
      evidenceCount: 0,
      narrativeCount: 0,
      graphEntityCount: 0,
      graphRelationshipCount: 0,
    },
    projects: [],
    narratives: [],
    evidence: [],
    report: {
      id: "report-x",
      lens: "ecosystem" as const,
      title: "Test",
      sections: { thesis: "t" },
      evidenceIds: [],
      confidence: "illustrative" as const,
      generatedAt: "2024-01-01T00:00:00.000Z",
      isDemo: true,
    },
    knowledgeGraph: {
      entities: new Map(),
      relationships: [],
      adjacency: new Map(),
    },
  };
  const contentHash = hashSnapshotContent(partial);
  const realId = buildSnapshotId(referenceDate, contentHash);
  return { id: realId, ...partial } as unknown as Snapshot;
}

describe("FileSnapshotRepository — async contract", () => {
  it("save then get returns the same snapshot", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    const snap = makeSnapshot("2024-01-01");
    await repo.save(snap);
    const fetched = await repo.get(snap.id);
    expect(fetched).toBeDefined();
    // JSON roundtrip cannot preserve Map objects; compare everything else.
    expect(fetched!.id).toBe(snap.id);
    expect(fetched!.referenceDate).toBe(snap.referenceDate);
    expect(fetched!.options).toEqual(snap.options);
    expect(fetched!.summary).toEqual(snap.summary);
    expect(fetched!.projects).toEqual(snap.projects);
    expect(fetched!.narratives).toEqual(snap.narratives);
    expect(fetched!.evidence).toEqual(snap.evidence);
    expect(fetched!.report).toEqual(snap.report);
    // The adjacency map and entities index are reconstructed as plain
    // objects after JSON roundtrip; verify they have the same size.
    expect(Object.keys(fetched!.knowledgeGraph.entities)).toHaveLength(
      snap.knowledgeGraph.entities.size,
    );
    expect(fetched!.knowledgeGraph.relationships).toEqual(snap.knowledgeGraph.relationships);
  });

  it("get returns undefined for missing id", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    expect(await repo.get("nope")).toBeUndefined();
  });

  it("list returns snapshots in insertion order", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    const a = makeSnapshot("2024-01-01");
    const b = makeSnapshot("2024-01-02");
    const c = makeSnapshot("2024-01-03");
    await repo.save(a);
    await repo.save(b);
    await repo.save(c);
    const list = await repo.list();
    expect(list.map((s) => s.id)).toEqual([a.id, b.id, c.id]);
  });

  it("re-saving an id moves it to the end of insertion order", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    const a = makeSnapshot("2024-01-01");
    const b = makeSnapshot("2024-01-02");
    const c = makeSnapshot("2024-01-03");
    await repo.save(a);
    await repo.save(b);
    await repo.save(c);
    await repo.save(a); // re-insert
    const list = await repo.list();
    expect(list.map((s) => s.id)).toEqual([b.id, c.id, a.id]);
  });

  it("delete removes the file and updates order", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    const a = makeSnapshot("2024-01-01");
    const b = makeSnapshot("2024-01-02");
    await repo.save(a);
    await repo.save(b);
    expect(await repo.delete(a.id)).toBe(true);
    expect(await repo.get(a.id)).toBeUndefined();
    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(b.id);
  });

  it("delete returns false for missing id", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    expect(await repo.delete("nope")).toBe(false);
  });

  it("clear removes all snapshots", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    await repo.save(makeSnapshot("2024-01-01"));
    await repo.save(makeSnapshot("2024-01-02"));
    await repo.clear();
    expect(repo.size).toBe(0);
    expect(await repo.list()).toEqual([]);
  });

  it("size reflects stored count", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    expect(repo.size).toBe(0);
    await repo.save(makeSnapshot("2024-01-01"));
    expect(repo.size).toBe(1);
    await repo.save(makeSnapshot("2024-01-02"));
    expect(repo.size).toBe(2);
  });

  it("persists order across instances", async () => {
    const repo1 = new FileSnapshotRepository({ directory: tmpDir });
    const a = makeSnapshot("2024-01-01");
    const b = makeSnapshot("2024-01-02");
    await repo1.save(a);
    await repo1.save(b);
    // New instance pointing at the same dir
    const repo2 = new FileSnapshotRepository({ directory: tmpDir });
    const list = await repo2.list();
    expect(list.map((s) => s.id)).toEqual([a.id, b.id]);
  });

  it("uses the deterministic snapshot id as the filename", async () => {
    const repo = new FileSnapshotRepository({ directory: tmpDir });
    const snap = makeSnapshot("2024-01-01");
    await repo.save(snap);
    const files = await fs.readdir(tmpDir);
    const json = files.find((f) => f.endsWith(".json") && f !== ".order.json");
    expect(json).toBeDefined();
    expect(json!.startsWith(snap.id)).toBe(true);
  });
});

describe("Repository polymorphism", () => {
  it("InMemorySnapshotRepository satisfies SyncSnapshotRepository", () => {
    const repo: import("../../src/snapshot").SyncSnapshotRepository =
      new InMemorySnapshotRepository();
    expect(typeof repo.save).toBe("function");
    expect(typeof repo.get).toBe("function");
  });

  it("FileSnapshotRepository satisfies AsyncSnapshotRepository", () => {
    const repo: import("../../src/snapshot").AsyncSnapshotRepository = new FileSnapshotRepository({
      directory: tmpDir,
    });
    expect(typeof repo.save).toBe("function");
    expect(typeof repo.get).toBe("function");
  });
});
