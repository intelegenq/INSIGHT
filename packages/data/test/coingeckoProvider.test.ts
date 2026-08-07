import { describe, expect, it } from "vitest";
import { HttpClient } from "../src/providers/base/HttpClient";
import { BaseProvider } from "../src/providers/base/BaseProvider";
import { MockHttpClient } from "../src/providers/mock/MockHttpClient";
import { CoinGeckoProvider } from "../src/providers/coingecko/CoinGeckoProvider";
import type {
  ProviderFetch,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../src/interfaces/DataProvider";

describe("CoinGeckoProvider", () => {
  const sampleAssets = [
    {
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
      current_price: 67000,
      market_cap: 1_320_000_000_000,
      market_cap_rank: 1,
      fully_diluted_valuation: 1_400_000_000_000,
      total_volume: 25_000_000_000,
      high_24h: 68000,
      low_24h: 66000,
      price_change_24h: 500,
      price_change_percentage_24h: 0.75,
      market_cap_change_24h: 10_000_000_000,
      market_cap_change_percentage_24h: 0.76,
      circulating_supply: 19_700_000,
      total_supply: 21_000_000,
      max_supply: 21_000_000,
      ath: 73738,
      ath_change_percentage: -9.13,
      ath_date: "2024-03-14T07:17:13.536Z",
      atl: 67.81,
      atl_change_percentage: 98700,
      atl_date: "2013-07-06T00:00:00.000Z",
      last_updated: "2024-08-07T10:00:00.000Z",
    },
    {
      id: "ethereum",
      symbol: "eth",
      name: "Ethereum",
      image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
      current_price: 3400,
      market_cap: 410_000_000_000,
      market_cap_rank: 2,
      fully_diluted_valuation: 410_000_000_000,
      total_volume: 15_000_000_000,
      high_24h: 3500,
      low_24h: 3300,
      price_change_24h: 50,
      price_change_percentage_24h: 1.5,
      market_cap_change_24h: 6_000_000_000,
      market_cap_change_percentage_24h: 1.48,
      circulating_supply: 120_000_000,
      total_supply: 120_000_000,
      max_supply: null,
      ath: 4878,
      ath_change_percentage: -30.3,
      ath_date: "2021-11-10T14:24:11.849Z",
      atl: 0.43,
      atl_change_percentage: 789000,
      atl_date: "2015-10-20T00:00:00.000Z",
      last_updated: "2024-08-07T10:00:00.000Z",
    },
  ];

  it("extends BaseProvider with coingecko identity", () => {
    const provider = new CoinGeckoProvider(
      {},
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    expect(provider).toBeInstanceOf(BaseProvider);
    expect(provider.id).toBe("coingecko");
    expect(provider.name).toBe("CoinGecko");
  });

  it("reports healthy when /ping returns expected response", async () => {
    const mock = new MockHttpClient().when(
      "api.coingecko.com",
      {
        ok: true,
        status: 200,
        data: { gecko_says: "(V3) To the Moon!" },
      },
      "GET",
    );

    const provider = new CoinGeckoProvider({}, { httpClient: new HttpClient({}, mock) });

    const health = await provider.health();
    expect(health.available).toBe(true);
    expect(health.id).toBe("coingecko");
  });

  it("reports unhealthy when /ping returns unexpected response", async () => {
    const mock = new MockHttpClient().when(
      "api.coingecko.com",
      {
        ok: true,
        status: 200,
        data: { gecko_says: "unexpected" },
      },
      "GET",
    );

    const provider = new CoinGeckoProvider({}, { httpClient: new HttpClient({}, mock) });

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("reports unhealthy on network error", async () => {
    const mock = new MockHttpClient().when(
      "api.coingecko.com",
      {
        ok: false,
        status: 500,
        data: null,
      },
      "GET",
    );

    const provider = new CoinGeckoProvider({}, { httpClient: new HttpClient({}, mock) });

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("reports unhealthy on timeout", async () => {
    const mock = new MockHttpClient().on(() => {
      return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 100));
    });

    const provider = new CoinGeckoProvider(
      { timeout: 50 },
      { httpClient: new HttpClient({}, mock) },
    );

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("fetches raw projects from /coins/markets", async () => {
    const mock = new MockHttpClient().when(
      "api.coingecko.com",
      {
        ok: true,
        status: 200,
        data: sampleAssets,
      },
      "GET",
    );

    const provider = new CoinGeckoProvider({}, { httpClient: new HttpClient({}, mock) });

    const result = await provider.fetchProjects();

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe("coingecko-bitcoin");
    expect(result.data[0]?.name).toBe("Bitcoin");
    expect(result.data[0]?.category).toBe("market-asset");
    expect(result.data[0]?.description).toContain("BTC");
    expect(result.data[0]?.description).toContain("Market Cap");
    expect(result.data[1]?.id).toBe("coingecko-ethereum");
    expect(result.data[1]?.name).toBe("Ethereum");
    expect(result.data[1]?.category).toBe("market-asset");
  });

  it("handles empty response", async () => {
    const mock = new MockHttpClient().when(
      "api.coingecko.com",
      {
        ok: true,
        status: 200,
        data: [],
      },
      "GET",
    );

    const provider = new CoinGeckoProvider({}, { httpClient: new HttpClient({}, mock) });

    const result = await provider.fetchProjects();
    expect(result.data).toEqual([]);
  });

  it("handles invalid response shape gracefully", async () => {
    const mock = new MockHttpClient().when(
      "api.coingecko.com",
      {
        ok: true,
        status: 200,
        data: "not-an-array",
      },
      "GET",
    );

    const provider = new CoinGeckoProvider({}, { httpClient: new HttpClient({}, mock) });

    const result = await provider.fetchProjects();
    expect(result.data).toEqual([]);
  });

  it("returns empty stubs for evidence", async () => {
    const provider = new CoinGeckoProvider(
      {},
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    const evidence = await provider.fetchEvidence();
    expect(evidence.data).toEqual([]);
  });

  it("returns empty stubs for narratives", async () => {
    const provider = new CoinGeckoProvider(
      {},
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    const narratives = await provider.fetchNarratives();
    expect(narratives.data).toEqual([]);
  });

  it("enforces rate limiting when configured", async () => {
    let clock = 0;
    const mock = new MockHttpClient().when(
      "api.coingecko.com",
      {
        ok: true,
        status: 200,
        data: sampleAssets,
      },
      "GET",
    );

    const provider = new CoinGeckoProvider(
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
        data: sampleAssets,
      },
      "GET",
    );

    const provider = new CoinGeckoProvider(
      { apiUrl: "https://custom.api.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    await provider.fetchProjects();
    const requests = mock.requests;
    expect(requests[0]?.url).toContain("custom.api.com");
  });

  it("uses HttpClient for requests (no direct fetch)", async () => {
    const mock = new MockHttpClient().when(
      "api.coingecko.com",
      {
        ok: true,
        status: 200,
        data: sampleAssets,
      },
      "GET",
    );

    const provider = new CoinGeckoProvider({}, { httpClient: new HttpClient({}, mock) });

    await provider.fetchProjects();
    const requests = mock.requests;
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.url).toContain("/coins/markets");
  });
});
