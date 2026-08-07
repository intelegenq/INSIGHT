/**
 * @insight/runtime/snapshot — InMemorySnapshotRepository.
 *
 * Deterministic, insertion-ordered, in-memory implementation of
 * {@link SnapshotRepository}. No filesystem, no database, no internal
 * timestamps — every operation depends solely on the inputs supplied by
 * the caller.
 */

import type { Snapshot } from "./Snapshot";
import type { SnapshotRepository } from "./SnapshotRepository";

/**
 * In-memory snapshot repository.
 *
 * `save()` keeps insertion order; `list()` returns snapshots in the order
 * they were inserted. `delete()` removes by id while leaving relative order
 * of remaining snapshots intact.
 */
export class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly store = new Map<string, Snapshot>();

  /** Number of stored snapshots. */
  get size(): number {
    return this.store.size;
  }

  /** Persist a snapshot. Returns the stored immutable snapshot. */
  save(snapshot: Snapshot): Snapshot {
    // Re-insertion moves to the end of insertion order (deterministic).
    this.store.delete(snapshot.id);
    this.store.set(snapshot.id, Object.freeze(deepFreeze(snapshot)) as Snapshot);
    return this.store.get(snapshot.id) as Snapshot;
  }

  /** Retrieve a snapshot by id. */
  get(id: string): Snapshot | undefined {
    return this.store.get(id);
  }

  /** List snapshots in insertion order (oldest first). */
  list(): Snapshot[] {
    return Array.from(this.store.values());
  }

  /** Remove a snapshot by id. */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  /** Remove all stored snapshots. */
  clear(): void {
    this.store.clear();
  }
}

/** Recursively freeze an object graph so stored snapshots are immutable. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  return value;
}