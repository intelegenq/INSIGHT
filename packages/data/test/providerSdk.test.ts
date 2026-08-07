import { describe, expect, it } from "vitest";
import { HttpClient } from "../src/providers/base/HttpClient";
import { BaseProvider } from "../src/providers/base/BaseProvider";
import { MockHttpClient } from "../src/providers/mock/MockHttpClient";
import { HeliusProvider } from "../src/providers/helius/HeliusProvider";
import type {
  ProviderFetch,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../src/interfaces/DataProvider";

/** A tiny concrete provider for testing BaseProvider behavior. */
class TestProvider extends BaseProvider {
  fetchProjects(): Promise<ProviderFetch<RawProject>> {
    this.acquire(); // enforce rate limit
    return Promise.resolve({ data: [], asOf: "1970-01-01T00:00:00.000Z" });
  }
  fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    this.acquire();
    return Promise.resolve({ data: [], asOf: "1970-01-01T00:00:00.000Z" });
  }
  fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    this.acquire();
    return Promise.resolve({ data: [], asOf: "1970-01-01T00:00:00.000Z" });
  }
}

describe("BaseProvider", () => {
  it("exposes id and name from options", async () => {
    const provider = new TestProvider({
      id: "test",
      name: "Test provider",
      httpClient: new HttpClient({}, new MockHttpClient()),
    });

    expect(provider.id).toBe("test");
    expect(provider.name).toBe("Test provider");
  });

  it("reports healthy by default", async () => {
    const provider = new TestProvider({
      id: "test",
      name: "Test provider",
      httpClient: new HttpClient({}, new MockHttpClient()),
    });

    const health = await provider.health();
    expect(health.available).toBe(true);
    expect(health.id).toBe("test");
  });

  it("enforces rate limiting when configured", async () => {
    let clock = 0;
    const provider = new TestProvider({
      id: "test",
      name: "Test provider",
      httpClient: new HttpClient({}, new MockHttpClient()),
      rateLimit: { capacity: 1, refillPerSecond: 0 },
      clock: () => clock,
    });

    await provider.fetchProjects(); // first call succeeds

    // Second call should throw synchronously (since acquire is sync now)
    expect(() => provider.fetchProjects()).toThrow(/Rate limit/);
  });
});

describe("HeliusProvider", () => {
  it("extends BaseProvider with the helius identity", () => {
    const provider = new HeliusProvider(
      { apiKey: "test-key" },
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    expect(provider).toBeInstanceOf(BaseProvider);
    expect(provider.id).toBe("helius");
    expect(provider.name).toBe("Helius");
  });

  it("reports healthy when the RPC responds", async () => {
    const mock = new MockHttpClient().when(
      "mainnet.helius-rpc.com",
      {
        ok: true,
        status: 200,
        data: { jsonrpc: "2.0", result: "ok" },
      },
      "POST",
    );
    const provider = new HeliusProvider(
      { apiKey: "test-key" },
      { httpClient: new HttpClient({}, mock) },
    );

    const health = await provider.health();
    expect(health.available).toBe(true);
  });

  it("reports unhealthy when the RPC fails", async () => {
    const mock = new MockHttpClient().when(
      "mainnet.helius-rpc.com",
      {
        ok: false,
        status: 500,
        data: null,
      },
      "POST",
    );
    const provider = new HeliusProvider(
      { apiKey: "bad-key" },
      { httpClient: new HttpClient({}, mock) },
    );

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("fetches raw projects through the http client", async () => {
    const mock = new MockHttpClient().when(
      "mainnet.helius-rpc.com",
      {
        ok: true,
        status: 200,
        data: { jsonrpc: "2.0", result: "0xdeadbeef" },
      },
      "POST",
    );
    const provider = new HeliusProvider(
      { apiKey: "test-key" },
      { httpClient: new HttpClient({}, mock) },
    );

    const result = await provider.fetchProjects();
    console.log("result", result);
    console.log("requests", mock.requests);
    console.log("handlers", mock.handlers);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toContain("helius-");
  });

  it("returns empty stubs for evidence and narratives", async () => {
    const provider = new HeliusProvider(
      { apiKey: "test-key" },
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    const evidence = await provider.fetchEvidence();
    const narratives = await provider.fetchNarratives();

    expect(evidence.data).toEqual([]);
    expect(narratives.data).toEqual([]);
  });
});
