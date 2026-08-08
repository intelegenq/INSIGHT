import type { Evidence, Narrative, Project, Report } from "@insight/core";
import type { KnowledgeGraph } from "@insight/knowledge";
import type { RuntimeOptions, RuntimeResult } from "../types";
import type { Snapshot } from "./Snapshot";
import { buildSnapshotId, hashSnapshotContent } from "./Snapshot";
import { assertValid, validateReferenceDate, validateExecutionId } from "../validation";

export interface CreateSnapshotInput {
  referenceDate: string;
  options: RuntimeOptions;
  summary: RuntimeResult["summary"];
  projects: readonly Project[];
  narratives: readonly Narrative[];
  evidence: readonly Evidence[];
  report: Report;
  knowledgeGraph: KnowledgeGraph;
  executionId?: string;
  jobId?: string;
}

export function createSnapshot(input: CreateSnapshotInput): Snapshot {
  assertValid(validateReferenceDate(input.referenceDate), "createSnapshot");
  if (input.executionId !== undefined) assertValid(validateExecutionId(input.executionId), "createSnapshot");
  const base = toBaseSnapshot(input);
  const id = buildSnapshotId(input.referenceDate, hashSnapshotContent(base));
  return Object.freeze({ ...base, id, createdAt: input.referenceDate }) as Snapshot;
}

export function snapshotFromRuntimeResult(result: RuntimeResult, options: RuntimeOptions, jobId?: string, executionId?: string): Snapshot {
  return createSnapshot({ referenceDate: result.timestamp, options, summary: result.summary, projects: result.projects, narratives: result.narratives, evidence: result.evidence, report: result.report, knowledgeGraph: result.knowledgeGraph, ...(jobId !== undefined ? { jobId } : {}), ...(executionId !== undefined ? { executionId } : {}) });
}

function toBaseSnapshot(input: CreateSnapshotInput): Omit<Snapshot, "id"> {
  return { referenceDate: input.referenceDate, createdAt: input.referenceDate, options: input.options, summary: input.summary, projects: input.projects, narratives: input.narratives, evidence: input.evidence, report: input.report, knowledgeGraph: input.knowledgeGraph, ...(input.executionId !== undefined ? { executionId: input.executionId } : {}), ...(input.jobId !== undefined ? { jobId: input.jobId } : {}) };
}
