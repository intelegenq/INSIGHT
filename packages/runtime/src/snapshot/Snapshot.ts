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
import type { RuntimeOptions, RuntimeResult, RuntimeSummary } from "../types";
import { validateExecutionId, validateReferenceDate, assertValid } from "../validation";

/**
 * A snapshot of a runtime execution.
 *
 * Snapshots are immutable. Repositories must not mutate them after save.
 *
 * The `executionId` field is optional and accepted as a courtesy to the
 * upstream scheduler lifecycle contract; when present it links the snapshot
 * back to the {@link import("../scheduler/types").ExecutionRecord} that
 * produced it.
 */
export interface Snapshot {
  /** Deterministic identifier derived from snapshot contents. */
  readonly id: string;
  /** Reference to the originating ExecutionRecord, when known. */
  readonly executionId?: string;
  /** ISO-8601 timestamp when the snapshot was created (from runtime options). */
  readonly createdAt?: string;
  /** Reference date captured from the underlying RuntimeResult.timestamp. */
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
  /** Optional: the full RuntimeResult, for downstream consumers that want it. */
  readonly result?: RuntimeResult;
  /** Optional: the job identifier that triggered this snapshot. */
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
 * Create a snapshot from components with validation.
 */
export function createSnapshot(input: {
  referenceDate: string;
  options: RuntimeOptions;
  summary: RuntimeSummary;
  projects: readonly Project[];
  narratives: readonly Narrative[];
  evidence: readonly Evidence[];
  report: Report;
  knowledgeGraph: KnowledgeGraph;
  executionId?: string;
}): Snapshot {
  // Validate inputs
  assertValid(validateReferenceDate(input.referenceDate), "createSnapshot");
  if (input.executionId) {
    assertValid(validateExecutionId(input.executionId), "createSnapshot");
  }

  const base = {
    referenceDate: input.referenceDate,
    options: input.options,
    summary: input.summary,
    projects: input.projects,
    narratives: input.narratives,
    evidence: input.evidence,
    report: input.report,
    knowledgeGraph: input.knowledgeGraph,
    executionId: input.executionId,
  };

  const contentHash = hashSnapshotContent(base);
  const id = buildSnapshotId(input.referenceDate, contentHash);

  return Object.freeze({
    id,
    referenceDate: input.referenceDate,
    createdAt: input.referenceDate,
    options: input.options,
    summary: input.summary,
    projects: input.projects,
    narratives: input.narratives,
    evidence: input.evidence,
    report: input.report,
    knowledgeGraph: input.knowledgeGraph,
    executionId: input.executionId,
  });
}

/**
 * Compute a stable 32-bit FNV-1a hash for snapshot content used to derive IDs.
 * No external dependencies; deterministic across runs.
 */
export function hashSnapshotContent(snapshot: Omit<Snapshot, "id">): string {
  return fnv1a32Hex(stableStringify(snapshot)).toString(16).padStart(8, "0");
}

/**
 * Re-compute the canonical id of a snapshot from its current contents.
 * Used to verify integrity; mirrors {@link buildSnapshotId}.
 */
export function verifySnapshotId(snapshot: Snapshot): boolean {
  const base = { ...snapshot };
  delete (base as { id?: string }).id;
  const expected = buildSnapshotId(snapshot.referenceDate, hashSnapshotContent(base));
  return snapshot.id === expected;
}

/** Result of a snapshot integrity check. */
export interface IntegrityReport {
  /** The id of the snapshot that was checked. */
  id: string;
  /** True when the id matches the canonical derivation. */
  idValid: boolean;
  /** True when the content hash matches the expected hash for the id. */
  contentValid: boolean;
  /** Human-readable description of any issue, when not valid. */
  reason?: string;
}

/**
 * Verify a snapshot's integrity in detail. Returns a structured report
 * indicating whether the id is correctly derived from the content AND
 * the content hash matches the expected value for the id. A snapshot
 * passes integrity when both `idValid` and `contentValid` are true.
 */
export function verifySnapshot(snapshot: Snapshot): IntegrityReport {
  const idValid = verifySnapshotId(snapshot);
  if (!idValid) {
    return {
      id: snapshot.id,
      idValid: false,
      contentValid: false,
      reason: "snapshot id does not match the canonical derivation from content",
    };
  }
  // The id encodes the reference date and content hash. Re-derive and
  // confirm the embedded hash agrees with the actual content hash.
  const base = { ...snapshot };
  delete (base as { id?: string }).id;
  const actualHash = hashSnapshotContent(base);
  const expectedHash = snapshot.id.slice(snapshot.id.lastIndexOf("-") + 1);
  if (actualHash !== expectedHash) {
    return {
      id: snapshot.id,
      idValid: true,
      contentValid: false,
      reason: `content hash mismatch: id embeds ${expectedHash} but content hashes to ${actualHash}`,
    };
  }
  return { id: snapshot.id, idValid: true, contentValid: true };
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
