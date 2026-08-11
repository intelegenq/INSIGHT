/**
 * @insight/infra/sql — PostgresSnapshotRepository.
 *
 * A PostgreSQL-backed implementation of the existing
 * {@link import("@insight/runtime").AsyncSnapshotRepository} contract
 * (from packages/runtime/src/snapshot/SnapshotRepository.ts). It preserves
 * the exact public contract while storing snapshots as JSONB rows, so any
 * caller of `AsyncSnapshotRepository` (e.g. insight-service) can swap the
 * in-memory repository for this one without changing consumer code.
 */

import type { Snapshot, AsyncSnapshotRepository } from "@insight/runtime";
import type { SqlClient } from "./SqlClient";

/** Column layout of the `snapshot` table. */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS insight_snapshot (
  id             TEXT PRIMARY KEY,
  body           JSONB NOT NULL,
  reference_date TEXT NOT NULL,
  created_at     TEXT NOT NULL
);`;

/**
 * PostgresSnapshotRepository — async snapshot repo backed by a SQL store.
 * Pass any {@link SqlClient} (real pg driver in production, fake in tests).
 * Snapshots are stored as JSONB rows; `list()` returns them in stable order
 * (by created_at then id), matching the ordered semantics of the default.
 */
export class PostgresSnapshotRepository implements AsyncSnapshotRepository {
  private readonly client: SqlClient;

  constructor(client: SqlClient) {
    this.client = client;
  }

  /** Ensure the backing table exists (idempotent). */
  async initialize(): Promise<void> {
    await this.client.query(SCHEMA);
  }

  /** The read-only `size` from the contract. Async backends report 0;
   *  use {@link count} for the live value. */
  get size(): number {
    return 0;
  }

  /** Live count of stored snapshots. */
  async count(): Promise<number> {
    const result = await this.client.query("SELECT COUNT(*)::INT AS n FROM insight_snapshot");
    const n = result.rows[0]?.["n"];
    return typeof n === "number" ? n : Number(n);
  }

  async save(snapshot: Snapshot): Promise<Snapshot> {
    await this.client.query(
      `INSERT INTO insight_snapshot (id, body, reference_date, created_at)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body`,
      [
        snapshot.id,
        JSON.stringify(snapshot),
        snapshot.referenceDate,
        snapshot.createdAt ?? snapshot.referenceDate,
      ],
    );
    return snapshot;
  }

  async get(id: string): Promise<Snapshot | undefined> {
    const result = await this.client.query("SELECT body FROM insight_snapshot WHERE id = $1", [id]);
    const body = result.rows[0]?.["body"];
    return typeof body === "string" ? (JSON.parse(body) as Snapshot) : undefined;
  }

  async list(): Promise<Snapshot[]> {
    const result = await this.client.query(
      "SELECT body FROM insight_snapshot ORDER BY created_at ASC, id ASC",
    );
    return result.rows
      .map((r) => r["body"])
      .filter((b): b is string => typeof b === "string")
      .map((b) => JSON.parse(b) as Snapshot);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.client.query("DELETE FROM insight_snapshot WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async clear(): Promise<void> {
    await this.client.query("DELETE FROM insight_snapshot");
  }
}
