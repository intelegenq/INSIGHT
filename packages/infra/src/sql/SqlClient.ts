/**
 * @insight/infra/sql — SQL client contract (driver-agnostic).
 *
 * Modeled on the node-postgres API surface. Production wiring supplies a
 * real client (e.g. `pg` Pool); tests inject an in-memory fake. Only the
 * methods M26 adapters need are declared here.
 */

/** A row is a record of column values. */
export type SqlRow = Record<string, unknown>;

/** The result of an executed statement. */
export interface SqlResult {
  /** Affected rows for INSERT/UPDATE/DELETE; unspecified for SELECT. */
  rowCount: number | null;
  rows: SqlRow[];
}

/**
 * Minimal SQL client contract.
 * Implementations need only support parameterized statements and a single
 * transaction helper; both used by the M26 repository adapters.
 */
export interface SqlClient {
  /** Execute a parameterized SQL statement. */
  query(sql: string, params?: unknown[]): Promise<SqlResult>;
  /** Run `fn` inside a transaction (auto commit/rollback). */
  transaction<T>(fn: (tx: Pick<SqlClient, "query">) => Promise<T>): Promise<T>;
}