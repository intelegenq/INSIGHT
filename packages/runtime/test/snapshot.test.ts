import { describe, expect, it } from "vitest";
import { createSnapshot, verifySnapshotId } from "../src/snapshot/Snapshot";
import type { RuntimeResult, RuntimeOptions, RuntimeSummary } from "../src/types";
import type { Project, Narrative, Evidence, Report } from "@insight/core";
import type { KnowledgeGraph, Entity, Relationship } from "@insight/knowledge";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";
const EXECUTION_ID = "exec-test-123";

const mockProject: Project = {
  id: "proj-1",
  name: "Test Project",
  category: "defi",
  description: "A test project",
  metrics: { tvl: 1000000 },
  evidenceIds: ["ev-1"],
  updatedAt: REFERENCE_DATE,
};

const mockNarrative: Narrative = {
  id: "narr-1",
  name: "Test Narrative",
  trend: "up",
  change: "+10%",
  note: "Test narrative note",
  projectIds: ["proj-1"],
  evidenceIds: ["ev-1"],
};

const mockEvidence: Evidence = {
  id: "ev-1",
  source: { id: "src-1", name: "Test Source" },
  note: "Test evidence",
  status: "verified",
  observedAt: REFERENCE_DATE,
  reference: "https://example.com",
};

const mockEntities = new Map<string, Entity>([
  ["proj-1", { kind: "project", id: "proj-1", name: "Test Project", category: "defi" }],
]);

const mockAdjacency = new Map<string, readonly Relationship[]>();

const mockKnowledgeGraph: KnowledgeGraph = {
  entities: mockEntities,
  adjacency: mockAdjacency,
  relationships: [],
};

const mockReport: Report = {
  id: "report-1",
  lens: "ecosystem",
  title: "Test Report",
  sections: { thesis: "Test thesis", catalyst: "Test catalyst", risk: "Test risk" },
  evidenceIds: ["ev-1"],
  confidence: "medium",
  generatedAt: REFERENCE_DATE,
  isDemo: true,
};

const mockSummary: RuntimeSummary = {
  projectCount: 1,
  narrativeCount: 1,
  evidenceCount: 1,
  graphEntityCount: 1,
  graphRelationshipCount: 0,
};

const mockRuntimeResult: RuntimeResult = {
  projects: [mockProject],
  narratives: [mockNarrative],
  evidence: [mockEvidence],
  knowledgeGraph: mockKnowledgeGraph,
  report: mockReport,
  summary: mockSummary,
  timestamp: REFERENCE_DATE,
};

describe("Snapshot Contract", () => {
  it("creates a snapshot with deterministic ID", () => {
    const snapshot = createSnapshot(EXECUTION_ID, mockRuntimeResult, REFERENCE_DATE);

    expect(snapshot.id).toBeDefined();
    expect(snapshot.id.startsWith("snap-")).toBe(true);
    expect(snapshot.executionId).toBe(EXECUTION_ID);
    expect(snapshot.createdAt).toBe(REFERENCE_DATE);
    expect(snapshot.timestamp).toBe(REFERENCE_DATE);
    expect(snapshot.result).toBe(mockRuntimeResult);
  });

  it("same input produces same snapshot ID (deterministic)", () => {
    const snap1 = createSnapshot(EXECUTION_ID, mockRuntimeResult, REFERENCE_DATE);
    const snap2 = createSnapshot(EXECUTION_ID, mockRuntimeResult, REFERENCE_DATE);

    expect(snap1.id).toBe(snap2.id);
  });

  it("different executionId produces different snapshot ID", () => {
    const snap1 = createSnapshot("exec-1", mockRuntimeResult, REFERENCE_DATE);
    const snap2 = createSnapshot("exec-2", mockRuntimeResult, REFERENCE_DATE);

    expect(snap1.id).not.toBe(snap2.id);
  });

  it("different result produces different snapshot ID", () => {
    const result2: RuntimeResult = {
      ...mockRuntimeResult,
      projects: [{ ...mockProject, id: "proj-2", name: "Different Project" }],
    };

    const snap1 = createSnapshot(EXECUTION_ID, mockRuntimeResult, REFERENCE_DATE);
    const snap2 = createSnapshot(EXECUTION_ID, result2, REFERENCE_DATE);

    expect(snap1.id).not.toBe(snap2.id);
  });

  it("preserves RuntimeResult completely", () => {
    const snapshot = createSnapshot(EXECUTION_ID, mockRuntimeResult, REFERENCE_DATE);

    expect(snapshot.result.projects).toHaveLength(1);
    expect(snapshot.result.projects[0]!.id).toBe("proj-1");
    expect(snapshot.result.narratives).toHaveLength(1);
    expect(snapshot.result.evidence).toHaveLength(1);
    expect(snapshot.result.knowledgeGraph).toBeDefined();
    expect(snapshot.result.report).toBeDefined();
    expect(snapshot.result.summary.projectCount).toBe(1);
    expect(snapshot.result.timestamp).toBe(REFERENCE_DATE);
  });

  it("verifySnapshotId returns true for valid snapshot", () => {
    const snapshot = createSnapshot(EXECUTION_ID, mockRuntimeResult, REFERENCE_DATE);

    expect(verifySnapshotId(snapshot)).toBe(true);
  });

  it("verifySnapshotId returns false for tampered snapshot", () => {
    const snapshot = createSnapshot(EXECUTION_ID, mockRuntimeResult, REFERENCE_DATE);
    const tampered = { ...snapshot, id: "snap-fake-id" };

    expect(verifySnapshotId(tampered)).toBe(false);
  });

  it("snapshot ID contains executionId and hash", () => {
    const snapshot = createSnapshot(EXECUTION_ID, mockRuntimeResult, REFERENCE_DATE);

    expect(snapshot.id).toContain(EXECUTION_ID);
    // Format: snap-<executionId>-<8-char-hex>
    // executionId may contain hyphens, so split from the end
    const parts = snapshot.id.split("-");
    expect(parts[0]).toBe("snap");
    // The last part should be the 8-char hex hash
    const hash = parts[parts.length - 1]!;
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    // Everything between "snap-" and "-<hash>" is the executionId
    const reconstructedExecutionId = snapshot.id.slice(5, -(hash.length + 1));
    expect(reconstructedExecutionId).toBe(EXECUTION_ID);
  });
});