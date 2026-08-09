import { describe, expect, it } from "vitest";
import { detectAnomalies, detectEvidenceAnomalies } from "../src/anomalyDetector";
import type { Evidence } from "@insight/core";

describe("AnomalyDetector", () => {
  it("detects TVL drops exceeding threshold", () => {
    const diff = {
      fromId: "snap-1",
      toId: "snap-2",
      fromReferenceDate: "2026-01-01T00:00:00.000Z",
      toReferenceDate: "2026-01-08T00:00:00.000Z",
      projects: [
        {
          projectId: "proj-1",
          name: "Test Protocol",
          category: "defi",
          descriptionChanged: false,
          metrics: [
            {
              metric: "tvl",
              from: 1_000_000_000,
              to: 800_000_000,
              delta: -200_000_000,
              direction: "decreased" as const,
            },
          ],
        },
      ],
      narratives: [],
      summary: {
        addedProjects: 0,
        removedProjects: 0,
        commonProjects: 1,
        changedProjects: 1,
        changedNarratives: 0,
      },
    };
    const anomalies = detectAnomalies(diff as never);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0]!.type).toBe("tvl_drop");
    expect(anomalies[0]!.pctChange).toBe(-20);
  });

  it("detects volume surges exceeding threshold", () => {
    const diff = {
      fromId: "snap-1",
      toId: "snap-2",
      fromReferenceDate: "2026-01-01T00:00:00.000Z",
      toReferenceDate: "2026-01-08T00:00:00.000Z",
      projects: [
        {
          projectId: "proj-dex",
          name: "Test DEX",
          category: "defi",
          descriptionChanged: false,
          metrics: [
            {
              metric: "volume24h",
              from: 50_000_000,
              to: 80_000_000,
              delta: 30_000_000,
              direction: "increased" as const,
            },
          ],
        },
      ],
      narratives: [],
      summary: {
        addedProjects: 0,
        removedProjects: 0,
        commonProjects: 1,
        changedProjects: 1,
        changedNarratives: 0,
      },
    };
    const anomalies = detectAnomalies(diff as never);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0]!.type).toBe("volume_rise");
  });

  it("detects narrative trend shifts", () => {
    const diff = {
      fromId: "snap-1",
      toId: "snap-2",
      fromReferenceDate: "2026-01-01T00:00:00.000Z",
      toReferenceDate: "2026-01-08T00:00:00.000Z",
      projects: [],
      narratives: [
        {
          narrativeId: "nar-1",
          name: "Liquid Staking",
          fromTrend: "up",
          toTrend: "down",
          trendChange: "trend-shifted",
          noteChanged: false,
        },
      ],
      summary: {
        addedProjects: 0,
        removedProjects: 0,
        commonProjects: 0,
        changedProjects: 0,
        changedNarratives: 1,
      },
    };
    const anomalies = detectAnomalies(diff as never);
    const trendAnomaly = anomalies.find((a) => a.type === "trend_shift");
    expect(trendAnomaly).toBeDefined();
    expect(trendAnomaly!.targetName).toBe("Liquid Staking");
  });

  it("detects validator delinquency spikes from evidence", () => {
    const currentEvidence: Evidence[] = [
      {
        id: "solana-validators-700",
        source: { id: "solana-rpc", name: "Solana RPC" },
        note: "1800 active validators, 35 delinquent. Active stake: 400 SOL",
        status: "verified",
        observedAt: "2026-08-09T20:00:00.000Z",
      },
    ];
    const previousEvidence: Evidence[] = [
      {
        id: "solana-validators-699",
        source: { id: "solana-rpc", name: "Solana RPC" },
        note: "1800 active validators, 12 delinquent. Active stake: 400 SOL",
        status: "verified",
        observedAt: "2026-08-08T20:00:00.000Z",
      },
    ];
    const anomalies = detectEvidenceAnomalies(currentEvidence, previousEvidence);
    const delinquencyAnomaly = anomalies.find((a) => a.type === "validator_delinquency_spike");
    expect(delinquencyAnomaly).toBeDefined();
    expect(delinquencyAnomaly!.oldValue).toBe(12);
    expect(delinquencyAnomaly!.newValue).toBe(35);
  });

  it("detects TPS anomalies from evidence", () => {
    const currentEvidence: Evidence[] = [
      {
        id: "solana-performance-700",
        source: { id: "solana-rpc", name: "Solana RPC" },
        note: "2100 cluster nodes, ~1500 TPS (recent samples)",
        status: "verified",
        observedAt: "2026-08-09T20:00:00.000Z",
      },
    ];
    const previousEvidence: Evidence[] = [
      {
        id: "solana-performance-699",
        source: { id: "solana-rpc", name: "Solana RPC" },
        note: "2100 cluster nodes, ~3000 TPS (recent samples)",
        status: "verified",
        observedAt: "2026-08-08T20:00:00.000Z",
      },
    ];
    const anomalies = detectEvidenceAnomalies(currentEvidence, previousEvidence);
    const tpsAnomaly = anomalies.find((a) => a.type === "tps_anomaly");
    expect(tpsAnomaly).toBeDefined();
    expect(tpsAnomaly!.oldValue).toBe(3000);
    expect(tpsAnomaly!.newValue).toBe(1500);
  });

  it("detects SOL price moves from evidence", () => {
    const currentEvidence: Evidence[] = [
      {
        id: "coingecko-solana-market",
        source: { id: "coingecko", name: "CoinGecko" },
        note: "Solana (SOL) — Price: $120.00, Market Cap: $60B, 24h Volume: $2B, 24h Change: -8.50%",
        status: "verified",
        observedAt: "2026-08-09T20:00:00.000Z",
      },
    ];
    const previousEvidence: Evidence[] = [
      {
        id: "coingecko-solana-market",
        source: { id: "coingecko", name: "CoinGecko" },
        note: "Solana (SOL) — Price: $145.00, Market Cap: $72B, 24h Volume: $2.1B",
        status: "verified",
        observedAt: "2026-08-08T20:00:00.000Z",
      },
    ];
    const anomalies = detectEvidenceAnomalies(currentEvidence, previousEvidence);
    const priceAnomaly = anomalies.find((a) => a.type === "price_move");
    expect(priceAnomaly).toBeDefined();
    expect(priceAnomaly!.oldValue).toBe(145);
    expect(priceAnomaly!.newValue).toBe(120);
  });

  it("returns no anomalies when no significant changes", () => {
    const diff = {
      fromId: "snap-1",
      toId: "snap-2",
      fromReferenceDate: "2026-01-01T00:00:00.000Z",
      toReferenceDate: "2026-01-08T00:00:00.000Z",
      projects: [
        {
          projectId: "proj-1",
          name: "Stable Protocol",
          category: "defi",
          descriptionChanged: false,
          metrics: [
            {
              metric: "tvl",
              from: 1_000_000_000,
              to: 1_010_000_000,
              delta: 10_000_000,
              direction: "increased" as const,
            },
          ],
        },
      ],
      narratives: [],
      summary: {
        addedProjects: 0,
        removedProjects: 0,
        commonProjects: 1,
        changedProjects: 1,
        changedNarratives: 0,
      },
    };
    const anomalies = detectAnomalies(diff as never);
    expect(anomalies.filter((a) => a.type === "tvl_rise" || a.type === "tvl_drop")).toHaveLength(0);
  });
});
