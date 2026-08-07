import { describe, expect, it } from "vitest";
import { SignalEngine } from "../../src/signals/SignalEngine";
import { CorrelationEngine } from "../../src/signals/CorrelationEngine";
import { ConfidenceCalculator } from "../../src/signals/ConfidenceCalculator";
import type { EvidenceCollection, EvidenceItem } from "@insight/data";
import type { IntelligenceSignal } from "../../src/signals/SignalTypes";

// Helper to create mock evidence items
function createMockEvidence(
  id: string,
  type: string,
  provider: string,
  data: Record<string, unknown> = {},
  timestamp = Date.now(),
): EvidenceItem<unknown> {
  return {
    id,
    type,
    source: {
      id: `${provider}-${id}`,
      provider,
      timestamp,
      endpoint: "mock",
    },
    data,
    description: `Mock ${type} from ${provider}`,
  };
}

function createMockCollection(items: EvidenceItem<unknown>[]): EvidenceCollection<unknown> {
  return {
    timestamp: Date.now(),
    items,
    metadata: {
      providersQueried: new Set(items.map((i) => i.source.provider)).size,
      providersSucceeded: items.length,
      providersFailed: 0,
      durationMs: 100,
    },
  };
}

describe("ConfidenceCalculator", () => {
  const calculator = new ConfidenceCalculator();

  it("returns base confidence for zero evidence", () => {
    const result = calculator.calculate({
      evidenceCount: 0,
      providerCount: 0,
      correlationStrength: 0,
      recency: 0,
      evidenceTypes: 0,
    });
    // With zero evidence, base is 0.1 but should be clamped reasonably
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("increases with evidence count", () => {
    const low = calculator.calculate({
      evidenceCount: 1,
      providerCount: 1,
      correlationStrength: 0.5,
      recency: 0.5,
      evidenceTypes: 1,
    });
    const high = calculator.calculate({
      evidenceCount: 10,
      providerCount: 1,
      correlationStrength: 0.5,
      recency: 0.5,
      evidenceTypes: 1,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("increases with provider diversity", () => {
    const single = calculator.calculate({
      evidenceCount: 5,
      providerCount: 1,
      correlationStrength: 0.5,
      recency: 0.5,
      evidenceTypes: 2,
    });
    const multi = calculator.calculate({
      evidenceCount: 5,
      providerCount: 3,
      correlationStrength: 0.5,
      recency: 0.5,
      evidenceTypes: 2,
    });
    expect(multi).toBeGreaterThan(single);
  });

  it("increases with correlation strength", () => {
    const weak = calculator.calculate({
      evidenceCount: 5,
      providerCount: 2,
      correlationStrength: 0.2,
      recency: 0.5,
      evidenceTypes: 2,
    });
    const strong = calculator.calculate({
      evidenceCount: 5,
      providerCount: 2,
      correlationStrength: 0.9,
      recency: 0.5,
      evidenceTypes: 2,
    });
    expect(strong).toBeGreaterThan(weak);
  });

  it("increases with recency", () => {
    const stale = calculator.calculate({
      evidenceCount: 5,
      providerCount: 2,
      correlationStrength: 0.5,
      recency: 0.1,
      evidenceTypes: 2,
    });
    const fresh = calculator.calculate({
      evidenceCount: 5,
      providerCount: 2,
      correlationStrength: 0.5,
      recency: 0.9,
      evidenceTypes: 2,
    });
    expect(fresh).toBeGreaterThan(stale);
  });

  it("increases with evidence type diversity", () => {
    const singleType = calculator.calculate({
      evidenceCount: 5,
      providerCount: 2,
      correlationStrength: 0.5,
      recency: 0.5,
      evidenceTypes: 1,
    });
    const multiType = calculator.calculate({
      evidenceCount: 5,
      providerCount: 2,
      correlationStrength: 0.5,
      recency: 0.5,
      evidenceTypes: 4,
    });
    expect(multiType).toBeGreaterThan(singleType);
  });

  it("clamps to max 1.0", () => {
    const result = calculator.calculate({
      evidenceCount: 100,
      providerCount: 10,
      correlationStrength: 1,
      recency: 1,
      evidenceTypes: 10,
    });
    expect(result).toBeLessThanOrEqual(1);
  });

  it("clamps to min 0.0", () => {
    const result = calculator.calculate({
      evidenceCount: 0,
      providerCount: 0,
      correlationStrength: 0,
      recency: 0,
      evidenceTypes: 0,
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("detailed breakdown sums to confidence", () => {
    const { confidence, breakdown } = calculator.calculateDetailed({
      evidenceCount: 5,
      providerCount: 3,
      correlationStrength: 0.8,
      recency: 0.7,
      evidenceTypes: 3,
    });
    const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
    expect(Math.abs(confidence - sum)).toBeLessThan(0.001);
  });
});

describe("CorrelationEngine", () => {
  const engine = new CorrelationEngine();

  it("returns empty for empty collection", () => {
    const collection = createMockCollection([]);
    const result = engine.analyze(collection);
    expect(result).toEqual([]);
  });

  it("returns empty for single evidence", () => {
    const item = createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" });
    const collection = createMockCollection([item]);
    const result = engine.analyze(collection);
    expect(result).toEqual([]);
  });

  it("detects market-ecosystem correlation", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC", price: 67000 }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "Uniswap", tvl: 4_500_000_000 }),
    ];
    const collection = createMockCollection(items);
    const result = engine.analyze(collection);

    const marketCorr = result.find((r) => r.correlationType === "market-ecosystem-correlation");
    expect(marketCorr).toBeDefined();
    expect(marketCorr?.evidenceItems).toHaveLength(2);
    expect(marketCorr?.strength).toBeGreaterThan(0);
  });

  it("detects adoption-activity correlation", () => {
    const items = [
      createMockEvidence("1", "onchain-activity", "solana-rpc", { pubkey: "abc123" }),
      createMockEvidence("2", "wallet-activity", "helius", { name: "Wallet", category: "defi" }),
    ];
    const collection = createMockCollection(items);
    const result = engine.analyze(collection);

    const adoptionCorr = result.find((r) => r.correlationType === "adoption-activity-correlation");
    expect(adoptionCorr).toBeDefined();
    expect(adoptionCorr?.evidenceItems).toHaveLength(2);
  });

  it("detects multi-provider validation", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "Uniswap" }),
      createMockEvidence("3", "onchain-activity", "solana-rpc", { pubkey: "abc" }),
    ];
    const collection = createMockCollection(items);
    const result = engine.analyze(collection);

    const multiProvider = result.find((r) => r.correlationType === "multi-provider-validation");
    expect(multiProvider).toBeDefined();
    expect(multiProvider?.evidenceItems).toHaveLength(3);
    expect(multiProvider?.description).toContain("3 independent providers");
  });

  it("detects entity multi-facet", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "UNI", name: "Uniswap" }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "Uniswap", tvl: 4_500_000_000 }),
    ];
    const collection = createMockCollection(items);
    const result = engine.analyze(collection);

    const entityCorr = result.find((r) => r.correlationType === "entity-multi-facet");
    expect(entityCorr).toBeDefined();
    expect(entityCorr?.description).toContain("Uniswap");
  });

  it("ignores unrelated evidence types", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" }),
      createMockEvidence("2", "governance-activity", "unknown", { proposal: "test" }),
    ];
    const collection = createMockCollection(items);
    const result = engine.analyze(collection);

    // Should not find market-ecosystem (no protocol-tvl)
    const marketCorr = result.find((r) => r.correlationType === "market-ecosystem-correlation");
    expect(marketCorr).toBeUndefined();

    // But should find multi-provider validation
    const multiProvider = result.find((r) => r.correlationType === "multi-provider-validation");
    expect(multiProvider).toBeDefined();
  });
});

describe("SignalEngine", () => {
  const engine = new SignalEngine();

  it("returns empty for empty evidence", () => {
    const collection = createMockCollection([]);
    const signals = engine.generateSignals(collection);
    expect(signals).toEqual([]);
  });

  it("returns empty for single evidence", () => {
    const item = createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" });
    const collection = createMockCollection([item]);
    const signals = engine.generateSignals(collection);
    expect(signals).toEqual([]);
  });

  it("generates signal from market-ecosystem correlation", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC", price: 67000 }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "Uniswap", tvl: 4_500_000_000 }),
    ];
    const collection = createMockCollection(items);
    const signals = engine.generateSignals(collection);

    expect(signals.length).toBeGreaterThan(0);
    const signal = signals[0]!;
    expect(signal.type).toBe("ecosystem-growth");
    expect(signal.confidence).toBeGreaterThan(0.3);
    expect(signal.evidenceIds).toHaveLength(2);
    expect(signal.supportingEvidence).toHaveLength(2);
  });

  it("generates signal from adoption correlation", () => {
    const items = [
      createMockEvidence("1", "onchain-activity", "solana-rpc", { pubkey: "abc123" }),
      createMockEvidence("2", "wallet-activity", "helius", { name: "Phantom", category: "wallet" }),
    ];
    const collection = createMockCollection(items);
    const signals = engine.generateSignals(collection);

    expect(signals.length).toBeGreaterThan(0);
    const signal = signals[0]!;
    expect(signal.type).toBe("ecosystem-growth");
    expect(signal.metadata?.providerCount).toBe(2);
  });

  it("filters signals below minConfidence", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "SmallProtocol", tvl: 10000 }),
    ];
    const collection = createMockCollection(items);

    // Default minConfidence = 0.3
    const defaultSignals = engine.generateSignals(collection);

    // High threshold
    const strictEngine = new SignalEngine({ minConfidence: 0.9 });
    const strictSignals = strictEngine.generateSignals(collection);

    expect(strictSignals.length).toBeLessThanOrEqual(defaultSignals.length);
  });

  it("includes weak signals when configured", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "SmallProtocol", tvl: 10000 }),
    ];
    const collection = createMockCollection(items);

    const normalEngine = new SignalEngine({ includeWeakSignals: false });
    const normalSignals = normalEngine.generateSignals(collection);

    const weakEngine = new SignalEngine({ includeWeakSignals: true });
    const weakSignals = weakEngine.generateSignals(collection);

    expect(weakSignals.length).toBeGreaterThanOrEqual(normalSignals.length);
  });

  it("applies custom rules", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" }),
      createMockEvidence("2", "market-movement", "coingecko", { symbol: "ETH" }),
      createMockEvidence("3", "market-movement", "coingecko", { symbol: "SOL" }),
    ];
    const collection = createMockCollection(items);

    const customEngine = new SignalEngine({
      minConfidence: 0.1, // Lower threshold for this test
      customRules: [
        {
          id: "major-market-movers",
          applicableTypes: ["market-movement"],
          minMatches: 3,
          signalType: "market-momentum",
          titleTemplate: "Major Market Movers: {count} assets",
          descriptionTemplate: "{count} major assets showing price movement",
        },
      ],
    });

    const signals = customEngine.generateSignals(collection);
    const customSignal = signals.find((s) => s.type === "market-momentum");
    expect(customSignal).toBeDefined();
    expect(customSignal?.title).toContain("3 assets");
  });

  it("sorts signals by confidence descending", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "Uniswap", tvl: 4_500_000_000 }),
      createMockEvidence("3", "onchain-activity", "solana-rpc", { pubkey: "abc" }),
      createMockEvidence("4", "wallet-activity", "helius", { name: "Phantom" }),
    ];
    const collection = createMockCollection(items);
    const signals = engine.generateSignals(collection);

    expect(signals.length).toBeGreaterThan(0);
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i - 1]!.confidence).toBeGreaterThanOrEqual(signals[i]!.confidence);
    }
  });

  it("signal has required fields", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC" }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "Uniswap" }),
    ];
    const collection = createMockCollection(items);
    const signals = engine.generateSignals(collection);
    expect(signals.length).toBeGreaterThan(0);
    const signal = signals[0]!;

    expect(signal.id).toBeDefined();
    expect(signal.type).toBeDefined();
    expect(signal.title).toBeDefined();
    expect(signal.description).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(1);
    expect(signal.evidenceIds).toBeDefined();
    expect(signal.supportingEvidence).toBeDefined();
    expect(signal.timestamp).toBeDefined();
    expect(signal.metadata).toBeDefined();
  });

  it("no financial advice in signals", () => {
    const items = [
      createMockEvidence("1", "market-movement", "coingecko", { symbol: "BTC", price: 67000 }),
      createMockEvidence("2", "protocol-tvl", "defillama", { name: "Uniswap", tvl: 4_500_000_000 }),
    ];
    const collection = createMockCollection(items);
    const signals = engine.generateSignals(collection);

    for (const signal of signals) {
      // Should not contain trading language
      const text = `${signal.title} ${signal.description}`.toLowerCase();
      expect(text).not.toContain("buy");
      expect(text).not.toContain("sell");
      expect(text).not.toContain("long");
      expect(text).not.toContain("short");
      expect(text).not.toContain("profit");
      expect(text).not.toContain("investment");
      expect(text).not.toContain("recommend");
    }
  });
});
