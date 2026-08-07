/**
 * @insight/runtime/snapshot — createSnapshot helpers.
 *
 * These utilities convert runtime results into immutable snapshots.
 * They never read wall-clock time: every time-related field is supplied
 * by the caller.
 */

import type { Evidence, Narrative, Project, Report } from "@insight/core";
import type { KnowledgeGraph } from "@insight/knowledge";
import type { RuntimeOptions, RuntimeResult } from "../types";
import type { Snapshot } from "./Snapshot";
import { buildSnapshotId, hashSnapshotContent } from "./Snapshot";

/**
 * Arguments accepted by {@link createSnapshot}. Excludes the derived `id`
 * so callers cannot accidentally override the deterministic identifier.
 */
export interface CreateSnapshotInput {
  referenceDate: string;
  options: RuntimeOptions;
  summary: RuntimeResult["summary"];
  projects: readonly Project[];
  narratives: readonly Narrative[];
  evidence: readonly Evidence[];
  report: Report;
  knowledgeGraph: KnowledgeGraph;
  jobId?: string;
}

/**
 * Build a snapshot from raw inputs. The id is derived deterministically from
 * the reference date and a content hash.
 */
export function createSnapshot(input: CreateSnapshotInput): Snapshot {
  const base = toBaseSnapshot(input);
  const id = buildSnapshotId(input.referenceDate, hashSnapshotContent(base));
  return Object.freeze({ ...base, id }) as Snapshot;
}

/**
 * Convert a {@link RuntimeResult} into a snapshot. The reference date is
 * read from `RuntimeResult.timestamp` (which itself comes from the runtime's
 * `referenceDate` option — never wall-clock).
 */
export function snapshotFromRuntimeResult(
  result: RuntimeResult,
  options: RuntimeOptions,
  jobId?: string,
): Snapshot {
  return createSnapshot({
    referenceDate: result.timestamp,
    options,
    summary: result.summary,
    projects: result.projects,
    narratives: result.narratives,
    evidence: result.evidence,
    report: result.report,
    knowledgeGraph: result.knowledgeGraph,
    jobId,
  });
}

function toBaseSnapshot(input: CreateSnapshotInput): Omit<Snapshot, "id"> {
  return {
    referenceDate: input.referenceDate,
    options: input.options,
    summary: input.summary,
    projects: input.projects,
    narratives: input.narratives,
    evidence: input.evidence,
    report: input.report,
    knowledgeGraph: input.knowledgeGraph,
    ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
  };
}