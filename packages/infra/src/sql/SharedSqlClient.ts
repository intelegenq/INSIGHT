/**
 * SharedSqlClient — process-wide shared SQL client for production persistence.
 *
 * Both the ingestion worker and the web app must read/write the same
 * Postgres-backed snapshot store. This module resolves a single SqlClient
 * per process:
 *   - When INSIGHT_POSTGRES_URL is set AND the `pg` package is available,
 *     returns a real `pg.Pool`-backed client (production).
 *   - Otherwise returns `InMemorySqlClient` (dev/test — no external infra).
 *
 * The client is a process-wide singleton so the worker and API routes
 * within the same process share the same connection pool. In docker-compose,
 * both the worker container and web container connect to the same Postgres
 * instance via INSIGHT_POSTGRES_URL.
 */
import { resolveInfraConfig } from "../config";
import { InMemorySqlClient } from "../injection";
import type { SqlClient } from "./SqlClient";

let shared: SqlClient | undefined;

/**
 * Resolve the process-wide SqlClient.
 * Production: dynamic import of `pg` when INSIGHT_POSTGRES_URL is present.
 * Dev/test: InMemorySqlClient (no external dependencies).
 */
export async function getSharedSqlClient(): Promise<SqlClient> {
  if (shared !== undefined) return shared;

  const config = resolveInfraConfig();

  if (!config.postgresUrl) {
    shared = new InMemorySqlClient();
    return shared;
  }

  // Production: dynamically import pg so it's not a hard dependency
  // in dev/test environments where pg isn't installed.
  try {
    const pgModule = (await import("pg")) as {
      Pool: new (config: { connectionString: string }) => {
        query: (
          sql: string,
          params?: unknown[],
        ) => Promise<{
          rowCount: number | null;
          rows: Record<string, unknown>[];
        }>;
        end: () => Promise<void>;
      };
    };
    const pool = new pgModule.Pool({ connectionString: config.postgresUrl });
    shared = new PgPoolClient(pool);
    return shared;
  } catch {
    // pg not installed — fall back to in-memory so the pipeline still runs
    shared = new InMemorySqlClient();
    return shared;
  }
}

/**
 * PgPoolClient — adapts a pg.Pool to the SqlClient contract.
 * Maps pg's query() result to the SqlResult shape and provides
 * a no-op transaction wrapper (pg.Pool already wraps in implicit
 * transactions per query; for multi-statement transactions, callers
 * can use BEGIN/COMMIT explicitly).
 */
class PgPoolClient implements SqlClient {
  constructor(
    private readonly pool: {
      query: (
        sql: string,
        params?: unknown[],
      ) => Promise<{
        rowCount: number | null;
        rows: Record<string, unknown>[];
      }>;
      end: () => Promise<void>;
    },
  ) {}

  async query(
    sql: string,
    params: unknown[] = [],
  ): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }> {
    const result = await this.pool.query(sql, params);
    return { rowCount: result.rowCount, rows: result.rows };
  }

  async transaction<T>(fn: (tx: Pick<SqlClient, "query">) => Promise<T>): Promise<T> {
    await this.pool.query("BEGIN");
    try {
      const result = await fn(this);
      await this.pool.query("COMMIT");
      return result;
    } catch (error) {
      await this.pool.query("ROLLBACK");
      throw error;
    }
  }
}

/**
 * Reset the shared client (tests only).
 */
export function resetSharedSqlClient(): void {
  shared = undefined;
}
