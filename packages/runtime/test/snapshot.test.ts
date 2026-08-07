import { describe, expect, it } from "vitest";
import { createSnapshot, verifySnapshotId } from "../src/snapshot";
import type { RuntimeOptions, RuntimeSummary } from "../src/types";
import type { Project, Narrative, Evidence, Report } from "@insight/core";
import type { KnowledgeGraph } from "@insight/knowledge";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";
const EXECUTION_ID = "exec-1723032000000-1";

const mockProject: Project = {
  id: "proj-1",
  name: "Test Project",
  category: "defi",
  description: "A test project",
  metrics: { tvl: 1_000_000 },
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
  source: { id: "src-1", name: "Source 1" },
  note: "Evidence note",
  status: "verified",
  observedAt: REFERENCE_DATE,
};

const mockReport: Report = {
  id: "rep-1",
  lens: "ecosystem",
  title: "Test Report",
  sections: { thesis: "Thesis" },
  evidenceIds: ["ev-1"],
  confidence: "illustrative",
  generatedAt: REFERENCE_DATE,
  isDemo: true,
};

const mockGraph: KnowledgeGraph = {
  entities: new Map(),
  adjacency: new Map(),
  relationships: [],
};

const mockSummary: RuntimeSummary = {
  projectCount: 1,
  narrativeCount: 1,
  evidenceCount: 1,
  graphEntityCount: 0,
  graphRelationshipCount: 0,
};

const mockOptions: RuntimeOptions = { referenceDate: REFERENCE_DATE };

describe("snapshot contract (deterministic)", () => {
  it("produces identical snapshots for identical inputs", () => {
    const a = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [mockProject],
      narratives: [mockNarrative],
      evidence: [mockEvidence],
      report: mockReport,
      knowledgeGraph: mockGraph,
      executionId: EXECUTION_ID,
    });
    const b = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [mockProject],
      narratives: [mockNarrative],
      evidence: [mockEvidence],
      report: mockReport,
      knowledgeGraph: mockGraph,
      executionId: EXECUTION_ID,
    });
    expect(a.id).toBe(b.id);
  });

  it("verifySnapshotId returns true for a fresh snapshot", () => {
    const snap = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [mockProject],
      narratives: [mockNarrative],
      evidence: [mockEvidence],
      report: mockReport,
      knowledgeGraph: mockGraph,
      executionId: EXECUTION_ID,
    });
    expect(verifySnapshotId(snap)).toBe(true);
  });

  it("does not use Date.now or Math.random for ids", () => {
    const snap = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [mockProject],
      narratives: [],
      evidence: [],
      report: mockReport,
      knowledgeGraph: mockGraph,
    });
    expect(snap.id).toMatch(/^snapshot-2026-08-07T00:00:00\.000Z-[0-9a-f]{8}$/);
  });

  it("captures the referenceDate as createdAt when not provided separately", () => {
    const snap = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [],
      narratives: [],
      evidence: [],
      report: mockReport,
      knowledgeGraph: mockGraph,
    });
    expect(snap.createdAt).toBe(REFERENCE_DATE);
    expect(snap.referenceDate).toBe(REFERENCE_DATE);
  });

  it("snapshot is frozen (immutable)", () => {
    const snap = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [mockProject],
      narratives: [],
      evidence: [],
      report: mockReport,
      knowledgeGraph: mockGraph,
    });
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it("executionId is preserved when supplied", () => {
    const snap = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [],
      narratives: [],
      evidence: [],
      report: mockReport,
      knowledgeGraph: mockGraph,
      executionId: EXECUTION_ID,
    });
    expect(snap.executionId).toBe(EXECUTION_ID);
  });

  it("changing projects changes the snapshot id", () => {
    const a = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [mockProject],
      narratives: [],
      evidence: [],
      report: mockReport,
      knowledgeGraph: mockGraph,
    });
    const b = createSnapshot({
      referenceDate: REFERENCE_DATE,
      options: mockOptions,
      summary: mockSummary,
      projects: [{ ...mockProject, tvl: 2_000_000 } as unknown as Project],
      narratives: [],
      evidence: [],
      report: mockReport,
      knowledgeGraph: mockGraph,
    });
    expect(a.id).not.toBe(b.id);
  });

  it("different referenceDates produce different snapshot ids", () => {
    const a = createSnapshot({
      referenceDate: "2026-01-01T00:00:00.000Z",
      options: { referenceDate: "2026-01-01T00:00:00.000Z" },
      summary: mockSummary,
      projects: [],
      narratives: [],
      evidence: [],
      report: mockReport,
      knowledgeGraph: mockGraph,
    });
    const b = createSnapshot({
      referenceDate: "2026-01-02T00:00:00.000Z",
      options: { referenceDate: "2026-01-02T00:00:00.000Z" },
      summary: mockSummary,
      projects: [],
      narratives: [],
      evidence: [],
      report: mockReport,
      knowledgeGraph: mockGraph,
    });
    expect(a.id).not.toBe(b.id);
  });
});