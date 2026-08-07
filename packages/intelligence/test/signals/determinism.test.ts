import { describe, expect, it } from "vitest";
import { SignalEngine } from "../../src/signals/SignalEngine";
import { CorrelationEngine } from "../../src/signals/CorrelationEngine";
import type { EvidenceCollection, EvidenceItem } from "@insight/data";

/**
 * Determinism-focused tests for the intelligence signal layer.
 *
 * These tests guarantee that:
 *  - Same input → identical signals across many runs (no `Date.now()` leaks)
 *  - Signal IDs are stable functions of (kind, key, evidence IDs)
 *  - Recency factors depend on the supplied `referenceDate`, never wall-clock
 */

function ev(
  id: string,
  type: string,
  provider: string,
  timestamp: number,
  data: Record<string, unknown> = {},
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
    description: `${type} from ${provider}`,
  };
}

function collection(items: EvidenceItem<unknown>[]): EvidenceCollection<unknown> {
  return {
    timestamp: 0,
    items,
    metadata: {
      providersQueried: new Set(items.map((i) => i.source.provider)).size,
      providersSucceeded: items.length,
      providersFailed: 0,
      durationMs: 0,
    },
  };
}

describe("CorrelationEngine determinism", () => {
  const REF = "2026-01-15T12:00:00.000Z";
  const REF_MS = Date.parse(REF);

  const items: EvidenceItem<unknown>[] = [
    ev("a", "market-movement", "coingecko", REF_MS - 1_000, { symbol: "BTC" }),
    ev("b", "protocol-tvl", "defillama", REF_MS - 5_000, { name: "Uniswap" }),
    ev("c", "onchain-activity", "solana-rpc", REF_MS - 60_000, { pubkey: "xyz" }),
    ev("d", "wallet-activity", "helius", REF_MS - 120_000, { name: "Phantom" }),
  ];

  it("produces byte-identical output across multiple runs", () => {
    const engine = new CorrelationEngine();
    const first = JSON.stringify(engine.analyze(collection(items), REF));
    for (let i = 0; i < 50; i += 1) {
      const next = JSON.stringify(engine.analyze(collection(items), REF));
      expect(next).toBe(first);
    }
  });

  it("uses the supplied referenceDate for recency", () => {
    const engine = new CorrelationEngine();
    const recent = engine.analyze(collection(items), "2026-01-15T13:00:00.000Z");
    const stale = engine.analyze(collection(items), "2026-02-15T12:00:00.000Z");
    // The strengths of cross-type correlations depend on recency.
    const recentM = recent.find((r) => r.correlationType === "market-ecosystem-correlation");
    const staleM = stale.find((r) => r.correlationType === "market-ecosystem-correlation");
    expect(recentM).toBeDefined();
    expect(staleM).toBeDefined();
    expect((recentM as { strength: number }).strength).toBeGreaterThan(
      (staleM as { strength: number }).strength,
    );
  });

  it("is stable when referenceDate is omitted (uses collection-derived reference)", () => {
    const engine = new CorrelationEngine();
    const resultA = JSON.stringify(engine.analyze(collection(items)));
    const resultB = JSON.stringify(engine.analyze(collection(items)));
    expect(resultB).toBe(resultA);
  });

  it("respects an explicit referenceDate over the collection fallback", () => {
    const engine = new CorrelationEngine();
    const withRef = engine.analyze(collection(items), REF);
    const withoutRef = engine.analyze(collection(items));
    // Both should be deterministic; strengths may differ because the
    // fallback uses the items' own max timestamp. We assert determinism,
    // not numerical equality between modes.
    const secondWithRef = engine.analyze(collection(items), REF);
    const secondWithoutRef = engine.analyze(collection(items));
    expect(JSON.stringify(withRef)).toBe(JSON.stringify(secondWithRef));
    expect(JSON.stringify(withoutRef)).toBe(JSON.stringify(secondWithoutRef));
  });
});

describe("SignalEngine determinism", () => {
  const REF = "2026-01-15T12:00:00.000Z";
  const REF_MS = Date.parse(REF);

  const items: EvidenceItem<unknown>[] = [
    ev("a", "market-movement", "coingecko", REF_MS - 1_000, { symbol: "BTC", price: 67000 }),
    ev("b", "protocol-tvl", "defillama", REF_MS - 5_000, { name: "Uniswap", tvl: 4_500_000_000 }),
    ev("c", "onchain-activity", "solana-rpc", REF_MS - 60_000, { pubkey: "abc" }),
    ev("d", "wallet-activity", "helius", REF_MS - 120_000, { name: "Phantom" }),
  ];

  it("produces byte-identical signals across many runs", () => {
    const engine = new SignalEngine();
    const first = JSON.stringify(engine.generateSignals(collection(items), REF));
    for (let i = 0; i < 50; i += 1) {
      const next = JSON.stringify(engine.generateSignals(collection(items), REF));
      expect(next).toBe(first);
    }
  });

  it("signal IDs are stable functions of inputs", () => {
    const engine = new SignalEngine();
    const a = engine.generateSignals(collection(items), REF);
    const b = engine.generateSignals(collection(items), REF);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    for (const signal of a) {
      expect(signal.id).toMatch(/^signal-(corr|rule)\|[a-z0-9-]+\|[a-z0-9,]+-[0-9a-f]{1,8}$/);
    }
  });

  it("changing evidence IDs changes signal IDs (no collisions across inputs)", () => {
    const engine = new SignalEngine();
    const baseSignals = engine.generateSignals(collection(items), REF);

    const shiftedItems = items.map((item, i) => ({
      ...item,
      id: `shifted-${item.id}`,
    }));
    const shiftedSignals = engine.generateSignals(collection(shiftedItems), REF);
    expect(shiftedSignals.map((s) => s.id)).not.toEqual(baseSignals.map((s) => s.id));
  });

  it("signal timestamp equals the supplied referenceDate", () => {
    const engine = new SignalEngine();
    const signals = engine.generateSignals(collection(items), REF);
    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) {
      expect(signal.timestamp).toBe(REF_MS);
    }
  });

  it("different referenceDates produce different confidences (recency is honored)", () => {
    const engine = new SignalEngine();
    const recent = engine.generateSignals(collection(items), "2026-01-15T13:00:00.000Z");
    const stale = engine.generateSignals(collection(items), "2026-03-15T12:00:00.000Z");
    expect(recent.length).toBeGreaterThan(0);
    expect(stale.length).toBeGreaterThan(0);

    // Pick a correlation-derived signal (highest confidence) and compare.
    const recentTop = recent[0] as { confidence: number };
    const staleTop = stale[0] as { confidence: number };
    expect(recentTop.confidence).toBeGreaterThan(staleTop.confidence);
  });

  it("custom rule signal IDs are deterministic and rule-derived", () => {
    const engine = new SignalEngine({
      minConfidence: 0.1,
      customRules: [
        {
          id: "major-market-movers",
          applicableTypes: ["market-movement"],
          minMatches: 1,
          signalType: "market-momentum",
          titleTemplate: "Major Market Movers: {count} assets",
          descriptionTemplate: "{count} major assets showing price movement",
        },
      ],
    });
    const a = engine.generateSignals(collection(items), REF);
    const b = engine.generateSignals(collection(items), REF);
    const aRule = a.find((s) => s.type === "market-momentum");
    const bRule = b.find((s) => s.type === "market-momentum");
    expect(aRule).toBeDefined();
    expect(bRule).toBeDefined();
    expect(aRule?.id).toBe(bRule?.id);
    expect(aRule?.id).toMatch(/^signal-rule\|major-market-movers\|/);
  });

  it("output is stable even when wall-clock time differs between runs", async () => {
    const engine = new SignalEngine();
    const before = JSON.stringify(engine.generateSignals(collection(items), REF));
    // Wait for the wall clock to advance noticeably.
    await new Promise((resolve) => setTimeout(resolve, 25));
    const after = JSON.stringify(engine.generateSignals(collection(items), REF));
    expect(after).toBe(before);
  });

  it("no signal ID contains random-looking high-entropy tail", () => {
    const engine = new SignalEngine();
    const signals = engine.generateSignals(collection(items), REF);
    // FNV-1a output is a hex string; an 8-char entropy tail is acceptable.
    // Random-base36 tail previously used would look like /[a-z0-9]{4,}/ at the end.
    for (const signal of signals) {
      const tail = signal.id.split("-").pop() ?? "";
      expect(tail).toMatch(/^[0-9a-f]{1,8}$/);
    }
  });
});