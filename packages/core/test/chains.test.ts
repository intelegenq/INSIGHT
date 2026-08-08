/**
 * M28 — Multi-chain expansion: core chain contracts.
 *
 * Chain identity, backward compatibility (Solana default), chain-aware
 * identity keys, and dedup. All deterministic, no external services.
 */

import {
  SOLANA,
  ETHEREUM,
  CHAINS,
  DEFAULT_CHAIN,
  chainOf,
  chainInfo,
  evidenceKey,
  sameChain,
  dedupeByChain,
} from "../src/chains";
import type { Evidence, Project } from "../src/types";
import { describe, it, expect } from "vitest";

const ev = (partial: Partial<Evidence> & Pick<Evidence, "id">): Evidence => ({
  source: { id: "src", name: "Src" },
  note: "note",
  status: "verified",
  observedAt: "2026-01-01T00:00:00.000Z",
  ...partial,
});

describe("chain identity", () => {
  it("defaults to Solana when no chain is present (backward compatibility)", () => {
    expect(chainOf(undefined)).toBe("solana");
    expect(chainOf(ev({ id: "e1" }))).toBe("solana");
    expect(DEFAULT_CHAIN).toBe("solana");
  });

  it("honours an explicit chain field", () => {
    expect(chainOf(ev({ id: "e1", chain: "ethereum" }))).toBe("ethereum");
  });

  it("resolves chain from a reference when no chain field is set", () => {
    expect(chainOf({ reference: "https://solscan.io/tx/abc" })).toBe("solana");
    expect(chainOf({ reference: "https://etherscan.io/tx/0x1" })).toBe("ethereum");
    expect(chainOf({ reference: "eip155:1/tx/0x1" })).toBe("ethereum");
    expect(chainOf({ reference: "https://example.com/none" })).toBe("solana");
  });

  it("exposes chain metadata", () => {
    expect(SOLANA.symbol).toBe("SOL");
    expect(ETHEREUM.symbol).toBe("ETH");
    expect(chainInfo("ethereum").name).toBe("Ethereum");
    expect(chainInfo("polygon").name).toBe("polygon");
    expect(CHAINS.length).toBe(2);
  });
});

describe("chain-aware identity & compatibility", () => {
  it("namespaces evidence keys by chain so same id on two chains is distinct", () => {
    const solanaEv = ev({ id: "tx1" });
    const ethEv = ev({ id: "tx1", chain: "ethereum" });
    expect(evidenceKey(solanaEv)).toBe("solana:tx1");
    expect(evidenceKey(ethEv)).toBe("ethereum:tx1");
    expect(evidenceKey(solanaEv)).not.toBe(evidenceKey(ethEv));
  });

  it("sameChain compares resolved chains", () => {
    expect(sameChain(ev({ id: "a" }), ev({ id: "b" }))).toBe(true); // both default solana
    expect(sameChain(ev({ id: "a" }), ev({ id: "b", chain: "ethereum" }))).toBe(false);
  });

  it("dedupeByChain keeps one record per chain+id and preserves order", () => {
    const records = [
      ev({ id: "a" }),
      ev({ id: "a" }), // duplicate on solana
      ev({ id: "a", chain: "ethereum" }), // same id, different chain — kept
      ev({ id: "b" }),
    ];
    const out = dedupeByChain(records);
    expect(out.map((r) => evidenceKey(r))).toEqual(["solana:a", "ethereum:a", "solana:b"]);
  });

  it("existing Solana evidence without chain is unchanged by dedup", () => {
    const records = [ev({ id: "x" }), ev({ id: "y" }), ev({ id: "x" })];
    expect(dedupeByChain(records).map((r) => r.id)).toEqual(["x", "y"]);
  });

  it("core Evidence and Project accept an optional chain without breaking shape", () => {
    const e: Evidence = ev({ id: "e9", chain: "solana" });
    const p: Project = {
      id: "p1",
      name: "P",
      category: "defi",
      description: "d",
      metrics: {},
      evidenceIds: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
      chain: "solana",
    };
    expect(e.chain).toBe("solana");
    expect(p.chain).toBe("solana");
  });
});