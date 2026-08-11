/**
 * M28 — Multi-chain expansion: per-chain source health gating.
 *
 * Adapter over the canonical SourceHealthMonitor report — derives per-chain
 * gates without modifying the monitor. Solana remains the default.
 */

import { chainForProvider, chainHealthGates, isChainEnabled } from "../src/evidence/ChainHealth";
import type { SourceHealthReport, SourceHealthEntry } from "../src/monitoring/SourceHealthMonitor";
import { describe, it, expect } from "vitest";

const entry = (id: string, available: boolean): SourceHealthEntry => ({
  id,
  name: id,
  available,
  status: available ? "healthy" : "unavailable",
});

const report = (entries: SourceHealthEntry[]): SourceHealthReport => ({
  status: entries.every((e) => e.status === "healthy") ? "healthy" : "degraded",
  checkedAt: "2026-01-01T00:00:00.000Z",
  providers: entries,
  summary: {
    total: entries.length,
    healthy: entries.filter((e) => e.status === "healthy").length,
    unavailable: entries.filter((e) => e.status !== "healthy").length,
  },
});

describe("chainForProvider", () => {
  it("maps known providers to their chain", () => {
    expect(chainForProvider("solana-rpc")).toBe("solana");
    expect(chainForProvider("helius")).toBe("solana");
    expect(chainForProvider("ethereum-rpc")).toBe("ethereum");
  });

  it("defaults unknown providers to Solana", () => {
    expect(chainForProvider("coingecko")).toBe("solana");
    expect(chainForProvider("custom")).toBe("solana");
  });
});

describe("chain health gating", () => {
  it("enables a chain when all its providers are healthy", () => {
    const r = report([entry("solana-rpc", true), entry("helius", true)]);
    const gates = chainHealthGates(r);
    expect(gates.length).toBe(1);
    expect(gates[0]?.chain).toBe("solana");
    expect(gates[0]?.enabled).toBe(true);
    expect(isChainEnabled(r, "solana")).toBe(true);
  });

  it("disables a chain when any provider is unhealthy (quality gate)", () => {
    const r = report([entry("solana-rpc", true), entry("ethereum-rpc", false)]);
    expect(isChainEnabled(r, "solana")).toBe(true);
    expect(isChainEnabled(r, "ethereum")).toBe(false);
    const gates = chainHealthGates(r);
    const eth = gates.find((g) => g.chain === "ethereum");
    expect(eth?.unhealthy).toEqual(["ethereum-rpc"]);
  });

  it("isolates chains: a failing Ethereum provider does not affect Solana", () => {
    const r = report([entry("solana-rpc", true), entry("ethereum-rpc", false)]);
    const solana = chainHealthGates(r).find((g) => g.chain === "solana");
    expect(solana?.enabled).toBe(true);
    expect(solana?.unhealthy).toEqual([]);
  });
});
