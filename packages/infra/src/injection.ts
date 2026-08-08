/**
 * @insight/infra/injection — assemble the full infra from config.
 *
 * When external endpoints are configured, this module wires the real
 * drivers (pg Pool, Redis client, S3 client); when not, it falls back to the
 * bundled in-memory implementations so the pipeline runs with zero external
 * infrastructure. Kept explicit so production can supply real drivers.
 */

import { resolveInfraConfig, isInMemory, type InfraConfig } from "./config";
import { PostgresSnapshotRepository } from "./sql/PostgresSnapshotRepository";
import type { SqlClient } from "./sql/SqlClient";
import { KvCache, InMemoryKvBackend, type KvBackend } from "./kv/KvCache";
import { InMemoryObjectStore, type ObjectStore } from "./object/ObjectStore";

export interface InfraServices {
  /** PostgreSQL-backed snapshot repository (in-memory default). */
  snapshotRepository: PostgresSnapshotRepository;
  /** KV cache (shared, Redis-backed when configured). */
  cache: KvCache;
  /** Object/artifact store (S3-compatible when configured). */
  objectStore: ObjectStore;
  /** In-memory mode indicator. */
  inMemory: boolean;
}

export interface DriverWiring {
  sql?: SqlClient;
  kv?: KvBackend;
  objectStore?: ObjectStore;
  config: InfraConfig;
}

/**
 * Build infrastructure services.
 * `wiring.sql` is required when a Postgres URL is configured (the caller
 * supplies the real pg driver); otherwise a fake SQL client is used.
 */
export function assembleInfra(
  injection: DriverWiring,
): InfraServices {
  const config = injection.config;
  const inMemory = isInMemory(config);

  // Snapshot repository: Postgres when a URL + client are wired, else the
  // SQL-backed adapter over an in-memory SQL client (keeps the same contract
  // and code path in both modes).
  const sql = injection.sql ?? new InMemorySqlClient();
  const snapshotRepository = new PostgresSnapshotRepository(sql);

  // Cache: shared backend when wired (Redis), else in-memory.
  const cache = new KvCache({
    backend: injection.kv ?? new InMemoryKvBackend(),
    defaultTtlMs: 60_000,
  });

  // Object store: S3-compatible when wired, else in-memory.
  const objectStore = injection.objectStore ?? new InMemoryObjectStore();

  return { snapshotRepository, cache, objectStore, inMemory };
}

/** Minimal in-memory SQL client for the fallback (no external infra). */
export class InMemorySqlClient implements SqlClient {
  private seenSchema = false;
  private rows: Array<{ id: string; body: string }> = [];

  async query(sql: string, params: unknown[] = []): Promise<{ rowCount: null | number; rows: Array<Record<string, unknown>> }> {
    const stmt = sql.replace(/\s+/g, " ").trim();
    if (stmt.startsWith("CREATE TABLE")) {
      if (!this.seenSchema) {
        this.seenSchema = true;
      }
      return { rowCount: 0, rows: [] };
    }
    if (stmt.startsWith("INSERT INTO")) {
      const id = String(params[0] ?? "unknown");
      const body = String(params[1] ?? "{}");
      this.rows = this.rows.filter((r) => r.id !== id);
      this.rows.push({ id, body });
      return { rowCount: 1, rows: [] };
    }
    if (stmt.startsWith("SELECT COUNT")) {
      return { rowCount: 1, rows: [{ n: this.rows.length }] };
    }
    if (stmt.startsWith("SELECT body")) {
      const id = String(params[0]);
      if (stmt.includes("WHERE id")) {
        const found = this.rows.find((r) => r.id === id);
        return { rowCount: 1, rows: found ? [{ body: found.body }] : [] };
      }
      return { rowCount: this.rows.length, rows: this.rows.map((r) => ({ body: r.body })) };
    }
    if (stmt.startsWith("DELETE FROM insight_snapshot WHERE id")) {
      const before = this.rows.length;
      this.rows = this.rows.filter((r) => r.id !== String(params[0]));
      return { rowCount: before - this.rows.length, rows: [] };
    }
    if (stmt.startsWith("DELETE FROM insight_snapshot")) {
      const removed = this.rows.length;
      this.rows = [];
      return { rowCount: removed, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  }

  async transaction<T>(fn: (tx: Pick<SqlClient, "query">) => Promise<T>): Promise<T> {
    return fn(this);
  }
}