import { describe, expect, it } from "vitest";
import { HttpClient } from "../src/providers/base/HttpClient";
import { BaseProvider } from "../src/providers/base/BaseProvider";
import { MockHttpClient } from "../src/providers/mock/MockHttpClient";
import { DefiLlamaProvider } from "../src/providers/defillama/DefiLlamaProvider";
import type {
  ProviderFetch,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../src/interfaces/DataProvider";

describe("DefiLlamaProvider", () => {
  const sampleProtocols = [
    {
      id: "uniswap",
      name: "Uniswap",
      symbol: "UNI",
      category: "Dexes",
      chains: ["Ethereum", "Arbitrum", "Optimism", "Polygon", "Solana"],
      tvl: 4_500_000_000,
      change24h: 2.5,
      change7d: -1.2,
      change30d: 15.3,
      chainTvls: { Ethereum: 3_000_000_000, Arbitrum: 1_000_000_000, Solana: 500_000_000 },
      module: "uniswap",
      twitter: "Uniswap",
      auditLinks: [],
      listedAt: 1612345678,
      methodology: "AMM DEX",
      governanceId: "uniswap",
      forkedFrom: [],
      parentProtocol: "",
      oracles: [],
      chain: "Ethereum",
    },
    {
      id: "aave",
      name: "Aave",
      symbol: "AAVE",
      category: "Lending",
      chains: ["Ethereum", "Polygon", "Avalanche", "Solana"],
      tvl: 8_000_000_000,
      change24h: -0.5,
      change7d: 3.1,
      change30d: 8.7,
      chainTvls: { Ethereum: 5_000_000_000, Polygon: 2_000_000_000, Solana: 1_000_000_000 },
      module: "aave",
      twitter: "AaveAave",
      auditLinks: [],
      listedAt: 1590123456,
      methodology: "Lending pool",
      governanceId: "aave",
      forkedFrom: [],
      parentProtocol: "",
      oracles: ["Chainlink"],
      chain: "Ethereum",
    },
  ];

  it("extends BaseProvider with defillama identity", () => {
    const provider = new DefiLlamaProvider(
      {},
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    expect(provider).toBeInstanceOf(BaseProvider);
    expect(provider.id).toBe("defillama");
    expect(provider.name).toBe("DeFiLlama");
  });

  it("reports healthy when /protocols returns array", async () => {
    const mock = new MockHttpClient().when(
      "api.llama.fi",
      {
        ok: true,
        status: 200,
        data: sampleProtocols,
      },
      "GET",
    );

    const provider = new DefiLlamaProvider({}, { httpClient: new HttpClient({}, mock) });

    const health = await provider.health();
    expect(health.available).toBe(true);
    expect(health.id).toBe("defillama");
  });

  it("reports unhealthy when /protocols returns non-array", async () => {
    const mock = new MockHttpClient().when(
      "api.llama.fi",
      {
        ok: true,
        status: 200,
        data: { error: "invalid" },
      },
      "GET",
    );

    const provider = new DefiLlamaProvider({}, { httpClient: new HttpClient({}, mock) });

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("reports unhealthy on network error", async () => {
    const mock = new MockHttpClient().when(
      "api.llama.fi",
      {
        ok: false,
        status: 500,
        data: null,
      },
      "GET",
    );

    const provider = new DefiLlamaProvider({}, { httpClient: new HttpClient({}, mock) });

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("reports unhealthy on timeout", async () => {
    const mock = new MockHttpClient().on(() => {
      return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 100));
    });

    const provider = new DefiLlamaProvider(
      { timeout: 50 },
      { httpClient: new HttpClient({}, mock) },
    );

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("fetches raw projects from /protocols", async () => {
    const mock = new MockHttpClient().when(
      "api.llama.fi",
      {
        ok: true,
        status: 200,
        data: sampleProtocols,
      },
      "GET",
    );

    const provider = new DefiLlamaProvider({}, { httpClient: new HttpClient({}, mock) });

    const result = await provider.fetchProjects();

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe("defillama-uniswap");
    expect(result.data[0]?.name).toBe("Uniswap");
    expect(result.data[0]?.category).toBe("Dexes");
    expect(result.data[0]?.description).toContain("Solana");
    expect(result.data[0]?.description).toContain("TVL");
    expect(result.data[0]?.metrics?.tvl).toBe(500_000_000);
    expect(result.data[1]?.id).toBe("defillama-aave");
    expect(result.data[1]?.name).toBe("Aave");
    expect(result.data[1]?.category).toBe("Lending");
    expect(result.data[1]?.metrics?.tvl).toBe(1_000_000_000);
  });

  it("handles empty response", async () => {
    const mock = new MockHttpClient().when(
      "api.llama.fi",
      {
        ok: true,
        status: 200,
        data: [],
      },
      "GET",
    );

    const provider = new DefiLlamaProvider({}, { httpClient: new HttpClient({}, mock) });

    const result = await provider.fetchProjects();
    expect(result.data).toEqual([]);
  });

  it("handles invalid response shape gracefully", async () => {
    const mock = new MockHttpClient().when(
      "api.llama.fi",
      {
        ok: true,
        status: 200,
        data: "not-an-array",
      },
      "GET",
    );

    const provider = new DefiLlamaProvider({}, { httpClient: new HttpClient({}, mock) });

    const result = await provider.fetchProjects();
    expect(result.data).toEqual([]);
  });

  it("returns empty stubs for evidence", async () => {
    const provider = new DefiLlamaProvider(
      {},
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    const evidence = await provider.fetchEvidence();
    expect(evidence.data).toEqual([]);
  });

  it("returns empty stubs for narratives", async () => {
    const provider = new DefiLlamaProvider(
      {},
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    const narratives = await provider.fetchNarratives();
    expect(narratives.data).toEqual([]);
  });

  it("enforces rate limiting when configured", async () => {
    let clock = 0;
    const mock = new MockHttpClient().when(
      "api.llama.fi",
      {
        ok: true,
        status: 200,
        data: sampleProtocols,
      },
      "GET",
    );

    const provider = new DefiLlamaProvider(
      {},
      {
        httpClient: new HttpClient({}, mock),
        rateLimit: { capacity: 1, refillPerSecond: 0 },
        clock: () => clock,
      },
    );

    await provider.fetchProjects();
    await expect(provider.fetchProjects()).rejects.toThrow(/Rate limit/);
  });

  it("respects custom apiUrl config", async () => {
    const mock = new MockHttpClient().when(
      "custom.api.com",
      {
        ok: true,
        status: 200,
        data: sampleProtocols,
      },
      "GET",
    );

    const provider = new DefiLlamaProvider(
      { apiUrl: "https://custom.api.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    await provider.fetchProjects();
    const requests = mock.requests;
    expect(requests[0]?.url).toContain("custom.api.com");
  });

  it("uses HttpClient for requests (no direct fetch)", async () => {
    const mock = new MockHttpClient().when(
      "api.llama.fi",
      {
        ok: true,
        status: 200,
        data: sampleProtocols,
      },
      "GET",
    );

    const provider = new DefiLlamaProvider({}, { httpClient: new HttpClient({}, mock) });

    await provider.fetchProjects();
    const requests = mock.requests;
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]?.method).toBe("GET");
  });
});
