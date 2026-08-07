/**
 * @insight/runtime/snapshot — SnapshotRepository contracts.
 *
 * Repositories store and retrieve immutable {@link Snapshot} records.
 * The contracts are deliberately minimal so different implementations
 * (memory, filesystem, database) can satisfy them without coupling to
 * scheduler or runtime internals.
 *
 * Two flavours are exposed:
 *   - {@link SyncSnapshotRepository}  — in-memory or other sync backends
 *   - {@link AsyncSnapshotRepository} — filesystem, database, or remote
 *
 * Both flavours are intentionally narrow so a single integration site
 * can pick the one matching its deployment target. New implementations
 * should pick the flavour that matches the backend's I/O characteristics.
 */

import type { Snapshot } from "./Snapshot";

/**
 * Synchronous snapshot repository contract.
 *
 * Implementations must:
 *  - Preserve insertion order in {@link SyncSnapshotRepository.list}
 *  - Return the same immutable object on every {@link SyncSnapshotRepository.get}
 *  - Never mutate stored snapshots
 *  - Never invent timestamps internally
 */
export interface SyncSnapshotRepository {
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

/**
 * Asynchronous snapshot repository contract.
 *
 * Same invariants as {@link SyncSnapshotRepository}, but the operations
 * return promises because the backing store may need to perform I/O.
 */
export interface AsyncSnapshotRepository {
  /** Persist a snapshot and return the stored value (with id assigned). */
  save(snapshot: Snapshot): Promise<Snapshot>;
  /** Retrieve a snapshot by id, or undefined when missing. */
  get(id: string): Promise<Snapshot | undefined>;
  /** List all stored snapshots in insertion order. */
  list(): Promise<Snapshot[]>;
  /** Remove a snapshot by id. Returns true when a snapshot was removed. */
  delete(id: string): Promise<boolean>;
  /** Remove all stored snapshots. */
  clear(): Promise<void>;
  /** Total number of stored snapshots. */
  readonly size: number;
}

/**
 * SnapshotRepository — union type accepted by any code that does not care
 * whether the backing store is sync or async. Producers that need the
 * result of `get`/`list` directly should use the corresponding flavour.
 */
export type SnapshotRepository = SyncSnapshotRepository | AsyncSnapshotRepository;
