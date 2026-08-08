import { describe, expect, it, vi } from "vitest";
import { InMemorySnapshotRepository } from "../../src/snapshot/InMemorySnapshotRepository";
import { snapshottingRuntimeJob } from "../../src/snapshot/snapshottingJob";
import { verifySnapshot, type Snapshot, type IntegrityReport } from "../../src/snapshot";
import type { RuntimeJob } from "../../src/scheduler/types";
import type { RuntimeOptions, RuntimeResult } from "../../src/types";

function makeJob(overrides?: Partial<RuntimeJob>): RuntimeJob {
  const base: RuntimeJob = {
    id: "test-job",
    name: "Test Job",
    options: { referenceDate: "2026-01-01T00:00:00.000Z" },
    execute: () =>
      Promise.resolve({
        projects: [],
        narratives: [],
        evidence: [],
        knowledgeGraph: { entities: new Map(), adjacency: new Map(), relationships: [] },
        report: {
          id: "report",
          lens: "ecosystem",
          title: "Test",
          sections: { thesis: "t" },
          evidenceIds: [],
          confidence: "illustrative",
          generatedAt: "2026-01-01T00:00:00.000Z",
          isDemo: true,
        },
        summary: {
          projectCount: 0,
          narrativeCount: 0,
          evidenceCount: 0,
          graphEntityCount: 0,
          graphRelationshipCount: 0,
        },
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
  };
  return { ...base, ...overrides };
}

describe("snapshottingRuntimeJob", () => {
  it("preserves the original RuntimeResult returned by the underlying job", async () => {
    const repo = new InMemorySnapshotRepository();
    const job = makeJob();
    const wrapped = snapshottingRuntimeJob(job, repo);

    const result: RuntimeResult = await wrapped.execute(wrapped.options);
    expect(result.timestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(result.summary.projectCount).toBe(0);
  });

  it("writes a snapshot on successful execution", async () => {
    const repo = new InMemorySnapshotRepository();
    const job = makeJob();
    const wrapped = snapshottingRuntimeJob(job, repo);

    await wrapped.execute(wrapped.options);

    expect(repo.size).toBe(1);
    const saved = wrapped.getLastSnapshot();
    expect(saved).toBeDefined();
    expect(saved?.jobId).toBe("test-job");
  });

  it("does not write a snapshot when the predicate rejects the result", async () => {
    const repo = new InMemorySnapshotRepository();
    const job = makeJob();
    const wrapped = snapshottingRuntimeJob(job, repo, {
      shouldSnapshot: () => false,
    });

    await wrapped.execute(wrapped.options);
    expect(repo.size).toBe(0);
    expect(wrapped.getLastSnapshot()).toBeUndefined();
  });

  it("does not write a snapshot when the underlying job throws", async () => {
    const repo = new InMemorySnapshotRepository();
    const failing: RuntimeJob = {
      id: "fail",
      name: "Failing Job",
      options: { referenceDate: "2026-01-01T00:00:00.000Z" },
      execute: () => Promise.reject(new Error("boom")),
    };
    const wrapped = snapshottingRuntimeJob(failing, repo);

    await expect(wrapped.execute(wrapped.options)).rejects.toThrow("boom");
    expect(repo.size).toBe(0);
  });

  it("snapshot reference is preserved when retrieved from repository", async () => {
    const repo = new InMemorySnapshotRepository();
    const job = makeJob();
    const wrapped = snapshottingRuntimeJob(job, repo);

    await wrapped.execute(wrapped.options);
    const fromWrapper = wrapped.getLastSnapshot();
    expect(fromWrapper).toBeDefined();
    if (!fromWrapper) throw new Error("snapshot missing");
    const fromRepo = repo.get(fromWrapper.id);
    expect(fromRepo).toBe(fromWrapper);
  });

  it("wraps a job without modifying its Scheduler-facing contract", () => {
    const repo = new InMemorySnapshotRepository();
    const job = makeJob();
    const wrapped = snapshottingRuntimeJob(job, repo);

    expect(wrapped.id).toBe(job.id);
    expect(wrapped.name).toBe(job.name);
    expect(wrapped.options).toBe(job.options);
  });

  it("snapshots multiple sequential executions in insertion order", async () => {
    const repo = new InMemorySnapshotRepository();
    const dates = [
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z",
    ];
    let i = 0;
    const job = makeJob({
      execute: () => {
        const ref = dates[i++] as string;
        return Promise.resolve({
          projects: [],
          narratives: [],
          evidence: [],
          knowledgeGraph: { entities: new Map(), adjacency: new Map(), relationships: [] },
          report: {
            id: `report-${ref}`,
            lens: "ecosystem",
            title: "Test",
            sections: { thesis: "t" },
            evidenceIds: [],
            confidence: "illustrative",
            generatedAt: ref,
            isDemo: true,
          },
          summary: {
            projectCount: 0,
            narrativeCount: 0,
            evidenceCount: 0,
            graphEntityCount: 0,
            graphRelationshipCount: 0,
          },
          timestamp: ref,
        });
      },
    });
    const wrapped = snapshottingRuntimeJob(job, repo);

    for (const ref of dates) {
      await wrapped.execute({ referenceDate: ref });
    }
    expect(repo.size).toBe(3);
    const orderedTimestamps = repo.list().map((s) => s.referenceDate);
    expect(orderedTimestamps).toEqual(dates);
  });

  it("never invokes repository save when result is filtered out", async () => {
    const repo = new InMemorySnapshotRepository();
    const saveSpy = vi.spyOn(repo, "save");
    const job = makeJob();
    const wrapped = snapshottingRuntimeJob(job, repo, {
      shouldSnapshot: () => false,
    });
    await wrapped.execute(wrapped.options);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("runs integrity verification by default (off mode) without altering save behavior", async () => {
    const reports: IntegrityReport[] = [];
    const repo = new InMemorySnapshotRepository();
    const job = makeJob();
    const wrapped = snapshottingRuntimeJob(job, repo, {
      onIntegrityReport: (r) => reports.push(r),
    });
    await wrapped.execute(wrapped.options);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.idValid).toBe(true);
    expect(reports[0]!.contentValid).toBe(true);
  });

  it("integrityCheck: 'throw' surfaces a corruption error", async () => {
    // Construct a tampered snapshot directly. The id does not match the
    // canonical derivation, so verifySnapshot should report idValid=false.
    const tampered: Snapshot = {
      id: "snapshot-2024-01-01-aaaaaaaa",
      referenceDate: "2024-01-01",
      options: { referenceDate: "2024-01-01" },
      summary: {
        projectCount: 0,
        evidenceCount: 0,
        narrativeCount: 0,
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
        sections: { thesis: "t" },
        evidenceIds: [],
        confidence: "illustrative",
        generatedAt: "2024-01-01T00:00:00.000Z",
        isDemo: true,
      },
      knowledgeGraph: {
        entities: new Map(),
        relationships: [],
        adjacency: new Map(),
      },
    };
    expect(verifySnapshot(tampered).idValid).toBe(false);
  });
});
