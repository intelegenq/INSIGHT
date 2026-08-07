import { describe, expect, it } from "vitest";
import { Scheduler } from "../src/scheduler/Scheduler";
import { InsightRuntimeJob } from "../src/scheduler/InsightRuntimeJob";
import type { RuntimeOptions, RuntimeResult } from "../src/types";
import type { ScheduledJob } from "../src/scheduler/types";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";
const options: RuntimeOptions = { referenceDate: REFERENCE_DATE };

describe("InsightRuntimeJob", () => {
  it("creates a job instance", () => {
    const job = new InsightRuntimeJob("test-job", "Test Job", options);
    expect(job).toBeInstanceOf(InsightRuntimeJob);
    expect(job.id).toBe("test-job");
    expect(job.name).toBe("Test Job");
    expect(job.options).toBe(options);
  });

  it("executes and returns RuntimeResult", async () => {
    const job = new InsightRuntimeJob("exec-job", "Execution Job", options);
    const result = await job.execute(options);

    expect(result).toBeDefined();
    expect(result.projects.length).toBeGreaterThan(0);
    expect(result.narratives.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.report).toBeDefined();
    expect(result.knowledgeGraph).toBeDefined();
    expect(result.timestamp).toBe(REFERENCE_DATE);
  });

  it("is deterministic: same input produces same output", async () => {
    const job = new InsightRuntimeJob("det-job", "Deterministic Job", options);
    const first = await job.execute(options);
    const second = await job.execute(options);

    expect(second).toEqual(first);
  });

  it("returns RuntimeResult with correct structure", async () => {
    const job = new InsightRuntimeJob("struct-job", "Structure Job", options);
    const result = await job.execute(options);

    expect(result).toMatchObject({
      projects: expect.any(Array),
      narratives: expect.any(Array),
      evidence: expect.any(Array),
      report: expect.any(Object),
      knowledgeGraph: expect.any(Object),
      summary: expect.objectContaining({
        projectCount: expect.any(Number),
        narrativeCount: expect.any(Number),
        evidenceCount: expect.any(Number),
        graphEntityCount: expect.any(Number),
        graphRelationshipCount: expect.any(Number),
      }),
      timestamp: REFERENCE_DATE,
    });
  });
});

describe("Scheduler with InsightRuntimeJob", () => {
  it("registers and executes a job", async () => {
    const scheduler = new Scheduler();
    const job = new InsightRuntimeJob("sched-job", "Scheduled Job", options);

    scheduler.register({
      ...job,
      execute: job.execute.bind(job),
      enabled: true,
    } as ScheduledJob);

    const result = await scheduler.execute("sched-job");

    expect(result).toBeDefined();
    expect(result.projects.length).toBeGreaterThan(0);
    expect(result.timestamp).toBe(REFERENCE_DATE);
  });

  it("throws on missing job", async () => {
    const scheduler = new Scheduler();

    await expect(scheduler.execute("non-existent")).rejects.toThrow("Job not found: non-existent");
  });

  it("throws on disabled job", async () => {
    const scheduler = new Scheduler();
    const job = new InsightRuntimeJob("disabled-job", "Disabled Job", options);

    scheduler.register({
      ...job,
      execute: job.execute.bind(job),
      enabled: false,
    } as ScheduledJob);

    await expect(scheduler.execute("disabled-job")).rejects.toThrow("Job disabled: disabled-job");
  });

  it("lists registered jobs", () => {
    const scheduler = new Scheduler();
    const job1 = new InsightRuntimeJob("job-1", "Job 1", options);
    const job2 = new InsightRuntimeJob("job-2", "Job 2", options);

    scheduler.register({ ...job1, execute: job1.execute.bind(job1), enabled: true } as ScheduledJob);
    scheduler.register({ ...job2, execute: job2.execute.bind(job2), enabled: true } as ScheduledJob);

    const list = scheduler.list();
    expect(list).toHaveLength(2);
    expect(list.map((j) => j.id).sort()).toEqual(["job-1", "job-2"]);
  });
});