/**
 * @insight/runtime/snapshot — persistent snapshot contracts.
 *
 * A snapshot is an immutable, deterministic capture of a {@link
 * import("../types").RuntimeResult}. The contract here is intentionally
 * framework-free: no filesystem, no database, no wall-clock reads.
 *
 * Time fields are explicit and required by the caller; the runtime layer
 * never invents timestamps of its own.
 */

import type { Evidence, Narrative, Project, Report } from "@insight/core";
import type { KnowledgeGraph } from "@insight/knowledge";
import type { RuntimeOptions, RuntimeSummary } from "../types";

/**
 * A snapshot of a runtime execution.
 *
 * Snapshots are immutable. Repositories must not mutate them after save.
 */
export interface Snapshot {
  /** Deterministic identifier derived from snapshot contents. */
  readonly id: string;
  /** ISO-8601 reference date the snapshot was generated for. */
  readonly referenceDate: string;
  /** The runtime options that produced this snapshot. */
  readonly options: RuntimeOptions;
  /** Snapshot summary statistics. */
  readonly summary: RuntimeSummary;
  /** Projects captured by the runtime execution. */
  readonly projects: readonly Project[];
  /** Narratives captured by the runtime execution. */
  readonly narratives: readonly Narrative[];
  /** Evidence captured by the runtime execution. */
  readonly evidence: readonly Evidence[];
  /** Report captured by the runtime execution. */
  readonly report: Report;
  /** Knowledge graph captured by the runtime execution. */
  readonly knowledgeGraph: KnowledgeGraph;
  /** Optional reference to the job that produced this snapshot. */
  readonly jobId?: string;
}

/**
 * Build a deterministic snapshot id from a reference date and content hash.
 * Same inputs always produce the same id (no timestamps, no randomness).
 */
export function buildSnapshotId(referenceDate: string, contentHash: string): string {
  return `snapshot-${referenceDate}-${contentHash}`;
}

/**
 * Compute a stable 32-bit FNV-1a hash for snapshot content used to derive IDs.
 * No external dependencies; deterministic across runs.
 */
export function hashSnapshotContent(snapshot: Omit<Snapshot, "id">): string {
  return fnv1a32Hex(stableStringify(snapshot)).toString(16).padStart(8, "0");
}

/** Stable JSON serialization: object keys are sorted recursively. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

/** FNV-1a 32-bit hash. */
function fnv1a32Hex(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}