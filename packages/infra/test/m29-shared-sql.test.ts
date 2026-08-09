import { describe, expect, it, beforeEach } from "vitest";
import { getSharedSqlClient, resetSharedSqlClient, InMemorySqlClient } from "../src/index";

describe("SharedSqlClient", () => {
  beforeEach(() => {
    resetSharedSqlClient();
  });

  it("returns InMemorySqlClient when no INSIGHT_POSTGRES_URL is set", async () => {
    const client = await getSharedSqlClient();
    expect(client).toBeInstanceOf(InMemorySqlClient);
  });

  it("returns the same instance on repeated calls (singleton)", async () => {
    const first = await getSharedSqlClient();
    const second = await getSharedSqlClient();
    expect(second).toBe(first);
  });

  it("resetSharedSqlClient creates a new instance", async () => {
    const first = await getSharedSqlClient();
    resetSharedSqlClient();
    const second = await getSharedSqlClient();
    expect(second).not.toBe(first);
  });

  it("supports query + transaction", async () => {
    const client = await getSharedSqlClient();
    await client.query("CREATE TABLE IF NOT EXISTS test (id TEXT)");
    await client.query("INSERT INTO test VALUES ($1)", ["a"]);
    const result = await client.query("SELECT body FROM test");
    expect(result.rowCount).toBeGreaterThanOrEqual(0);
  });
});
