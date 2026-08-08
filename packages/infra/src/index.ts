/**
 * @insight/infra — M26 database & worker infrastructure.
 *
 * Transport-agnostic adapters for PostgreSQL, Redis-style KV, S3-compatible
 * object storage, and Docker-compatible workers. Every adapter accepts an
 * injected backend client interface so unit tests run against in-memory/fake
 * backends with NO external infrastructure, while production docker-compose
 * wiring supplies the real drivers.
 */

/* ── PostgreSQL / relational store ─────────────────────────────────── */
export type { SqlClient, SqlRow, SqlResult } from "./sql/SqlClient";
export { PostgresSnapshotRepository } from "./sql/PostgresSnapshotRepository";

/* ── Redis / KV cache & queue ──────────────────────────────────────── */
export type { KvBackend, KvCacheOptions } from "./kv/KvCache";
export { KvCache, InMemoryKvBackend } from "./kv/KvCache";

/* ── S3-compatible object storage ──────────────────────────────────── */
export type { ObjectStore, ObjectStoreEntry } from "./object/ObjectStore";
export { InMemoryObjectStore } from "./object/ObjectStore";

/* ── Docker-compatible workers ─────────────────────────────────────── */
export type {
  WorkerSpec,
  WorkerRunOptions,
  WorkerRunner,
} from "./worker/WorkerRunner";
export {
  createWorkerRunner,
  runWorkerLoop,
  drainShutdownSignal,
} from "./worker/WorkerRunner";

/* ── Env-backed injection point ────────────────────────────────────── */
export { resolveInfraConfig, isInMemory, type InfraConfig } from "./config";
export { assembleInfra, InMemorySqlClient } from "./injection";
export type { DriverWiring, InfraServices } from "./injection";