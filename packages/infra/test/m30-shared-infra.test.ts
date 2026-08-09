import { describe, expect, it, beforeEach } from "vitest";
import {
  getSharedCache,
  getSharedObjectStore,
  resetSharedInfra,
  InMemoryKvBackend,
  InMemoryObjectStore,
} from "../src/index";

describe("SharedInfra (M30)", () => {
  beforeEach(() => {
    resetSharedInfra();
  });

  it("getSharedCache returns in-memory backend when no REDIS_URL", async () => {
    const cache = await getSharedCache();
    expect(cache).toBeDefined();
    await cache.set("test-key", { value: 42 });
    const result = await cache.get<{ value: number }>("test-key");
    expect(result?.value).toBe(42);
  });

  it("getSharedCache returns the same instance on repeated calls", async () => {
    const first = await getSharedCache();
    const second = await getSharedCache();
    expect(second).toBe(first);
  });

  it("getSharedObjectStore returns in-memory store when no S3_ENDPOINT", async () => {
    const store = await getSharedObjectStore();
    expect(store).toBeDefined();
    await store.put({
      key: "test.json",
      body: new TextEncoder().encode("hello"),
      contentType: "application/json",
    });
    const body = await store.get("test.json");
    expect(body).toBeDefined();
    expect(new TextDecoder().decode(body)).toBe("hello");
  });

  it("getSharedObjectStore returns the same instance on repeated calls", async () => {
    const first = await getSharedObjectStore();
    const second = await getSharedObjectStore();
    expect(second).toBe(first);
  });

  it("resetSharedInfra creates new instances", async () => {
    const first = await getSharedCache();
    resetSharedInfra();
    const second = await getSharedCache();
    expect(second).not.toBe(first);
  });
});
