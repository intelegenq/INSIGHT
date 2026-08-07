/**
 * @insight/runtime/snapshot — deterministic snapshot contract.
 *
 * Immutable record of a runtime analysis result.
 * Snapshot ID is generated deterministically from executionId + result hash.
 * No external storage, no timestamps from Date.now(), no randomness.
 */
import type { RuntimeResult } from "../types";

/**
 * Generate a deterministic snapshot ID from executionId and result content.
 * Uses a simple hash of the serialized result for content-addressable identity.
 */
function generateSnapshotId(executionId: string, result: RuntimeResult): string {
  // Create a stable string representation of the result for hashing
  const entities = Array.from(result.knowledgeGraph.entities.values());
  const resultString = JSON.stringify({
    projects: result.projects.map((p) => ({ id: p.id, name: p.name })),
    narratives: result.narratives.map((n) => ({ id: n.id, name: n.name })),
    evidence: result.evidence.map((e) => ({ id: e.id, note: e.note })),
    knowledgeGraph: {
      entities: entities.map((e) => ({ id: e.id, kind: e.kind })),
      relationships: result.knowledgeGraph.relationships.map((r) => ({ type: r.type, from: r.from, to: r.to, weight: r.weight })),
    },
    report: { title: result.report.title, sections: { thesis: result.report.sections.thesis, catalyst: result.report.sections.catalyst, risk: result.report.sections.risk } },
    summary: result.summary,
    timestamp: result.timestamp,
  });

  // Simple deterministic hash (FNV-1a 32-bit)
  let hash = 2166136261;
  for (let i = 0; i < resultString.length; i++) {
    hash ^= resultString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hashHex = (hash >>> 0).toString(16).padStart(8, "0");

  return `snap-${executionId}-${hashHex}`;
}

/**
 * Snapshot — immutable container for a runtime analysis result.
 * Links back to its originating execution record.
 */
export interface Snapshot {
  /** Deterministic ID: snap-<executionId>-<resultHash> */
  id: string;
  /** Reference to the ExecutionRecord that produced this result */
  executionId: string;
  /** ISO-8601 timestamp when snapshot was created (from runtime options) */
  createdAt: string;
  /** The reference timestamp of the analysis (from RuntimeResult) */
  timestamp: string;
  /** The complete runtime analysis result */
  result: RuntimeResult;
}

/**
 * Factory function to create a snapshot from an execution record and runtime result.
 * All timestamps are explicit inputs — never generated internally.
 */
export function createSnapshot(
  executionId: string,
  result: RuntimeResult,
  createdAt: string
): Snapshot {
  return {
    id: generateSnapshotId(executionId, result),
    executionId,
    createdAt,
    timestamp: result.timestamp,
    result,
  };
}

/**
 * Verify that a snapshot ID matches its content.
 * Useful for integrity checks when loading from storage.
 */
export function verifySnapshotId(snapshot: Snapshot): boolean {
  const expectedId = generateSnapshotId(snapshot.executionId, snapshot.result);
  return snapshot.id === expectedId;
}