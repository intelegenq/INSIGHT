import { describe, expect, it, vi } from "vitest";
import { EvidenceCollector } from "../../src/evidence/EvidenceCollector";
import { EvidenceNormalizer } from "../../src/evidence/EvidenceNormalizer";
import type {
  DataProvider,
  ProviderFetch,
  RawProject,
  RawEvidence,
  RawNarrative,
} from "../../src/interfaces/DataProvider";
import type { RawCoinGeckoMarketAsset } from "../../src/providers/coingecko/CoinGeckoProvider";
import type { RawDefiLlamaProtocol } from "../../src/providers/defillama/DefiLlamaProvider";
import type { RawProgramData } from "../../src/providers/solana/SolanaRPCProvider";
import { NormalizationRegistry } from "../../src/normalization/NormalizationRegistry";
import type { Normalizer } from "../../src/normalization/Normalizer";
import type { CanonicalEvidence } from "../../src/normalization/CanonicalEvidence";
import { createSourceMetadata } from "../../src/normalization/SourceMetadata";

// Mock provider factory
function createMockProvider(
  name: string,
  projects: RawProject[] = [],
  shouldFail = false,
  delay = 0,
): DataProvider {
  return {
    id: name,
    name: name,
    async health() {
      return { id: name, name, available: !shouldFail, note: shouldFail ? "failed" : "healthy" };
    },
    async fetchProjects(): Promise<ProviderFetch<RawProject>> {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (shouldFail) throw new Error(`${name} failed`);
      return { data: projects, asOf: new Date().toISOString() };
    },
    async fetchEvidence(): Promise<ProviderFetch<never>> {
      return { data: [], asOf: new Date().toISOString() };
    },
    async fetchNarratives(): Promise<ProviderFetch<never>> {
      return { data: [], asOf: new Date().toISOString() };
    },
  };
}

// Create a test normalizer for mock providers
function createTestNormalizer(
  providerName: string,
): Normalizer<RawProject | RawEvidence | RawNarrative> {
  return {
    supports: (sourceType: string) => sourceType === providerName,
    normalize: (input) => {
      const metadata = createSourceMetadata({
        provider: providerName,
        providerVersion: "1.0.0",
        schemaVersion: "1.0.0",
        collectedAt: Date.now(),
      });

      // Extend metadata to satisfy CanonicalEvidence requirement
      const extendedMetadata: import("../../src/normalization/SourceMetadata").SourceMetadata &
        Record<string, unknown> = {
        ...metadata,
      };

      const id = (input as RawProject)?.id ?? "unknown";

      return [
        {
          id: `${providerName}-${id}`,
          sourceId: providerName,
          sourceType: providerName,
          evidenceType: "raw-project" as const,
          collectedAt: Date.now(),
          content: input,
          tags: [],
          metadata: extendedMetadata,
        },
      ];
    },
  };
}

describe("EvidenceCollector", () => {
  it("collects from a single provider", async () => {
    const registry = new NormalizationRegistry();
    registry.register(createTestNormalizer("test-provider"), ["test-provider"]);

    const provider = createMockProvider("test-provider", [
      { id: "proj-1", name: "Project 1", category: "test", description: "desc" },
    ]);
    const collector = new EvidenceCollector(new Map([["test-provider", provider]]), {}, registry);

    const result = await collector.collect();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("test-provider-proj-1");
    expect(result.items[0]?.type).toBe("raw-project");
    expect(result.items[0]?.source.provider).toBe("test-provider");
    expect(result.items[0]?.data.content).toEqual({
      id: "proj-1",
      name: "Project 1",
      category: "test",
      description: "desc",
    });
    expect(result.metadata?.providersSucceeded).toBe(1);
    expect(result.metadata?.providersFailed).toBe(0);
  });

  it("collects from multiple providers", async () => {
    const registry = new NormalizationRegistry();
    registry.register(createTestNormalizer("provider-1"), ["provider-1"]);
    registry.register(createTestNormalizer("provider-2"), ["provider-2"]);

    const p1 = createMockProvider("provider-1", [
      { id: "a", name: "A", category: "c", description: "d" },
    ]);
    const p2 = createMockProvider("provider-2", [
      { id: "b", name: "B", category: "c", description: "d" },
    ]);
    const collector = new EvidenceCollector(
      new Map([
        ["provider-1", p1],
        ["provider-2", p2],
      ]),
      {},
      registry,
    );

    const result = await collector.collect();

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.source.provider).sort()).toEqual(["provider-1", "provider-2"]);
    expect(result.metadata?.providersSucceeded).toBe(2);
  });

  it("handles provider failure with continueOnFailure=true", async () => {
    const registry = new NormalizationRegistry();
    registry.register(createTestNormalizer("good"), ["good"]);
    registry.register(createTestNormalizer("bad"), ["bad"]);

    const p1 = createMockProvider("good", [
      { id: "a", name: "A", category: "c", description: "d" },
    ]);
    const p2 = createMockProvider("bad", [], true);
    const collector = new EvidenceCollector(
      new Map([
        ["good", p1],
        ["bad", p2],
      ]),
      { continueOnFailure: true },
      registry,
    );

    const result = await collector.collect();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.source.provider).toBe("good");
    expect(result.metadata?.providersSucceeded).toBe(1);
    expect(result.metadata?.providersFailed).toBe(1);
  });

  it("throws on provider failure with continueOnFailure=false", async () => {
    const registry = new NormalizationRegistry();
    registry.register(createTestNormalizer("good"), ["good"]);
    registry.register(createTestNormalizer("bad"), ["bad"]);

    const p1 = createMockProvider("good", [
      { id: "a", name: "A", category: "c", description: "d" },
    ]);
    const p2 = createMockProvider("bad", [], true);
    const collector = new EvidenceCollector(
      new Map([
        ["good", p1],
        ["bad", p2],
      ]),
      { continueOnFailure: false },
      registry,
    );

    await expect(collector.collect()).rejects.toThrow("bad failed");
  });

  it("includes collection metadata", async () => {
    const registry = new NormalizationRegistry();
    registry.register(createTestNormalizer("test"), ["test"]);

    const provider = createMockProvider("test", [
      { id: "a", name: "A", category: "c", description: "d" },
    ]);
    const collector = new EvidenceCollector(new Map([["test", provider]]), {}, registry);

    const result = await collector.collect();

    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.providersQueried).toBe(1);
    expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("respects timeout on slow provider", async () => {
    const registry = new NormalizationRegistry();
    registry.register(createTestNormalizer("slow"), ["slow"]);

    const provider = createMockProvider("slow", [], false, 1000);
    const collector = new EvidenceCollector(
      new Map([["slow", provider]]),
      { timeoutMs: 10, continueOnFailure: false },
      registry,
    );

    await expect(collector.collect()).rejects.toThrow("timed out after 10ms");
  });

  it("addProvider and removeProvider work", () => {
    const registry = new NormalizationRegistry();
    registry.register(createTestNormalizer("test"), ["test"]);

    const collector = new EvidenceCollector(new Map(), {}, registry);
    const provider = createMockProvider("test", []);

    collector.addProvider("test", provider);
    expect(collector.getProviderNames()).toEqual(["test"]);

    collector.removeProvider("test");
    expect(collector.getProviderNames()).toEqual([]);
  });

  it("returns empty evidence for unsupported provider", async () => {
    const registry = new NormalizationRegistry();
    // No normalizer registered for "unsupported"

    const provider = createMockProvider("unsupported", [
      { id: "a", name: "A", category: "c", description: "d" },
    ]);
    const collector = new EvidenceCollector(
      new Map([["unsupported", provider]]),
      { continueOnFailure: true },
      registry,
    );

    const result = await collector.collect();

    // Provider succeeds but no normalizer → empty evidence
    expect(result.items).toHaveLength(0);
    expect(result.metadata?.providersSucceeded).toBe(1);
  });

  it("normalizes multiple evidence items from single provider", async () => {
    const registry = new NormalizationRegistry();
    registry.register(createTestNormalizer("multi"), ["multi"]);

    const provider = createMockProvider("multi", [
      { id: "a", name: "A", category: "c", description: "d" },
      { id: "b", name: "B", category: "c", description: "d" },
      { id: "c", name: "C", category: "c", description: "d" },
    ]);
    const collector = new EvidenceCollector(new Map([["multi", provider]]), {}, registry);

    const result = await collector.collect();

    expect(result.items).toHaveLength(3);
    expect(result.items.map((i) => i.id).sort()).toEqual(["multi-a", "multi-b", "multi-c"]);
  });
});

describe("EvidenceNormalizer", () => {
  const normalizer = new EvidenceNormalizer();

  it("normalizes CoinGecko market assets", () => {
    const assets: RawCoinGeckoMarketAsset[] = [
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        current_price: 67000,
        market_cap: 1_320_000_000_000,
        total_volume: 25_000_000_000,
        price_change_percentage_24h: 2.5,
        market_cap_rank: 1,
        last_updated: "2024-08-07T10:00:00.000Z",
      },
    ];

    const result = normalizer.normalizeCoinGecko(assets);

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("coingecko-bitcoin");
    expect(result.items[0]?.type).toBe("market-movement");
    expect(result.items[0]?.source.provider).toBe("coingecko");
    expect(result.items[0]?.data.symbol).toBe("BTC");
    expect(result.items[0]?.data.price).toBe(67000);
    expect(result.items[0]?.data.priceChange24hPct).toBe(2.5);
  });

  it("normalizes DeFiLlama protocols", () => {
    const protocols: RawDefiLlamaProtocol[] = [
      {
        id: "uniswap",
        name: "Uniswap",
        symbol: "UNI",
        category: "Dexes",
        chains: ["Ethereum", "Arbitrum"],
        tvl: 4_500_000_000,
        change24h: 1.5,
        change7d: -0.5,
        change30d: 10.0,
        chainTvls: { Ethereum: 3_000_000_000 },
        module: "uniswap",
        governanceId: "uniswap",
        methodology: "AMM",
      },
    ];

    const result = normalizer.normalizeDeFiLlama(protocols);

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("defillama-uniswap");
    expect(result.items[0]?.type).toBe("protocol-tvl");
    expect(result.items[0]?.source.provider).toBe("defillama");
    expect(result.items[0]?.data.name).toBe("Uniswap");
    expect(result.items[0]?.data.tvl).toBe(4_500_000_000);
    expect(result.items[0]?.data.chains).toEqual(["Ethereum", "Arbitrum"]);
  });

  it("normalizes Solana RPC accounts", () => {
    const accounts: RawProgramData[] = [
      {
        pubkey: "11111111111111111111111111111111",
        account: {
          owner: "11111111111111111111111111111111",
          lamports: 1000000,
          executable: false,
          rentEpoch: 180,
          data: "base64encoded",
        },
      },
    ];

    const result = normalizer.normalizeSolana(accounts);

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("solana-rpc-11111111111111111111111111111111");
    expect(result.items[0]?.type).toBe("onchain-activity");
    expect(result.items[0]?.source.provider).toBe("solana-rpc");
    expect(result.items[0]?.data.pubkey).toBe("11111111111111111111111111111111");
    expect(result.items[0]?.data.lamports).toBe(1000000);
  });

  it("normalizes Helius data", () => {
    const projects: RawProject[] = [
      { id: "helius-1", name: "Helius Test", category: "infrastructure", description: "Test" },
    ];

    const result = normalizer.normalizeHelius(projects);

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("helius-helius-1");
    expect(result.items[0]?.type).toBe("wallet-activity");
    expect(result.items[0]?.source.provider).toBe("helius");
  });

  it("normalizes generic provider data", () => {
    const projects: RawProject[] = [
      { id: "custom-1", name: "Custom", category: "other", description: "Custom provider" },
    ];

    const result = normalizer.normalizeGeneric("custom-provider", projects);

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("custom-provider-custom-1");
    expect(result.items[0]?.type).toBe("raw-project");
    expect(result.items[0]?.source.provider).toBe("custom-provider");
  });

  it("dispatches to correct normalizer via normalizeFromProvider", () => {
    const cgAssets: RawCoinGeckoMarketAsset[] = [
      {
        id: "ethereum",
        symbol: "eth",
        name: "Ethereum",
        current_price: 3400,
        market_cap: 410_000_000_000,
        total_volume: 15_000_000_000,
        price_change_percentage_24h: -1.2,
        market_cap_rank: 2,
        last_updated: "2024-08-07T10:00:00.000Z",
      },
    ];

    const result = normalizer.normalizeFromProvider(
      "coingecko",
      cgAssets as unknown as RawProject[],
    );

    expect(result.success).toBe(true);
    expect(result.items[0]?.type).toBe("market-movement");
    expect(result.items[0]?.data.symbol).toBe("ETH");
  });

  it("handles empty input gracefully", () => {
    const result = normalizer.normalizeCoinGecko([]);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it("handles invalid raw data structure", () => {
    // @ts-expect-error - testing invalid input
    const result = normalizer.normalizeCoinGecko(null);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});
