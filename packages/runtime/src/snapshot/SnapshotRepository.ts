/**
 * @insight/runtime/snapshot — SnapshotRepository contract.
 *
 * Repositories store and retrieve immutable {@link Snapshot} records.
 * The contract is deliberately minimal so different implementations
 * (memory, filesystem, database) can satisfy it without coupling to
 * scheduler or runtime internals.
 */

import type { Snapshot } from "./Snapshot";

/**
 * Repository contract for runtime snapshots.
 *
 * Implementations must:
 *  - Preserve insertion order in {@link SnapshotRepository.list}
 *  - Return the same immutable object on every {@link SnapshotRepository.get}
 *  - Never mutate stored snapshots
 *  - Never invent timestamps internally
 */
export interface SnapshotRepository {
  /** Persist a snapshot and return the stored value (with id assigned). */
  save(snapshot: Snapshot): Snapshot;
  /** Retrieve a snapshot by id, or undefined when missing. */
  get(id: string): Snapshot | undefined;
  /** List all stored snapshots in insertion order. */
  list(): Snapshot[];
  /** Remove a snapshot by id. Returns true when a snapshot was removed. */
  delete(id: string): boolean;
  /** Remove all stored snapshots. */
  clear(): void;
  /** Total number of stored snapshots. */
  readonly size: number;
}