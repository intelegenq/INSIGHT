import { describe, expect, it } from "vitest";
import { resolveProductionProviders, hasLiveProviders } from "../src/providers/ProductionProviders";
import { MockHttpClient } from "../src/providers/mock/MockHttpClient";
import { DemoProvider } from "../src/providers/DemoProvider";
import { HeliusProvider } from "../src/providers/helius/HeliusProvider";
import { SolanaRPCProvider } from "../src/providers/solana/SolanaRPCProvider";
import { DefiLlamaProvider } from "../src/providers/defillama/DefiLlamaProvider";
import { CoinGeckoProvider } from "../src/providers/coingecko/CoinGeckoProvider";

describe("resolveProductionProviders", () => {
  it("returns demo-only in demo mode", () => {
    const providers = resolveProductionProviders({
      env: { NEXT_PUBLIC_INSIGHT_DATA_MODE: "demo" },
      transport: () => new MockHttpClient(),
    });
    expect(providers).toHaveLength(1);
    expect(providers[0]).toBeInstanceOf(DemoProvider);
  });

  it("includes Helius when API key is present", () => {
    const providers = resolveProductionProviders({
      env: { HELIUS_API_KEY: "test-key-123" },
      transport: () => new MockHttpClient(),
    });
    const helius = providers.find((p) => p.id === "helius");
    expect(helius).toBeDefined();
    expect(helius).toBeInstanceOf(HeliusProvider);
  });

  it("excludes Helius when API key is absent", () => {
    const providers = resolveProductionProviders({
      env: {},
      transport: () => new MockHttpClient(),
    });
    const helius = providers.find((p) => p.id === "helius");
    expect(helius).toBeUndefined();
  });

  it("includes SolanaRPC when RPC URL is present", () => {
    const providers = resolveProductionProviders({
      env: { SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com" },
      transport: () => new MockHttpClient(),
    });
    const solana = providers.find((p) => p.id === "solana-rpc");
    expect(solana).toBeDefined();
    expect(solana).toBeInstanceOf(SolanaRPCProvider);
  });

  it("always includes DeFiLlama and CoinGecko (public APIs)", () => {
    const providers = resolveProductionProviders({
      env: {},
      transport: () => new MockHttpClient(),
    });
    expect(providers.find((p) => p.id === "defillama")).toBeInstanceOf(DefiLlamaProvider);
    expect(providers.find((p) => p.id === "coingecko")).toBeInstanceOf(CoinGeckoProvider);
  });

  it("includes demo as fallback when no live providers are configured", () => {
    const providers = resolveProductionProviders({
      env: { NEXT_PUBLIC_INSIGHT_DATA_MODE: "demo" },
      transport: () => new MockHttpClient(),
    });
    expect(providers.find((p) => p.id === "demo")).toBeInstanceOf(DemoProvider);
  });

  it("does not include demo when live providers are configured", () => {
    const mock = new MockHttpClient();
    const providers = resolveProductionProviders({
      env: { DEFILLAMA_API_URL: "https://api.llama.fi" },
      transport: () => mock,
    });
    expect(providers.find((p) => p.id === "demo")).toBeUndefined();
    expect(providers.find((p) => p.id === "defillama")).toBeDefined();
  });

  it("respects custom API URLs", () => {
    const mock = new MockHttpClient().when(
      "custom.defillama.com",
      {
        ok: true,
        status: 200,
        data: [],
      },
      "GET",
    );

    const providers = resolveProductionProviders({
      env: { DEFILLAMA_API_URL: "https://custom.defillama.com" },
      transport: () => mock,
    });

    const defillama = providers.find((p) => p.id === "defillama") as DefiLlamaProvider;
    expect(defillama).toBeDefined();
  });
});

describe("hasLiveProviders", () => {
  it("returns false in demo mode", () => {
    expect(hasLiveProviders({ NEXT_PUBLIC_INSIGHT_DATA_MODE: "demo" })).toBe(false);
  });

  it("returns true when Helius key is present", () => {
    expect(hasLiveProviders({ HELIUS_API_KEY: "test" })).toBe(true);
  });

  it("returns true when Solana RPC URL is present", () => {
    expect(hasLiveProviders({ SOLANA_RPC_URL: "https://rpc.example.com" })).toBe(true);
  });

  it("returns true when DeFiLlama URL is present", () => {
    expect(hasLiveProviders({ DEFILLAMA_API_URL: "https://api.llama.fi" })).toBe(true);
  });

  it("returns false when no credentials are present", () => {
    expect(hasLiveProviders({})).toBe(false);
  });
});
