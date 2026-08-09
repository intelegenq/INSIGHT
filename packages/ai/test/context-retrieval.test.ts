import { describe, expect, it, beforeEach } from "vitest";
import {
  ContextRetriever,
  serializeContext,
  type InsightDataSource,
} from "../src/context/ContextRetriever";
import type { Project, Evidence, Narrative, Report } from "@insight/core";

// Deterministic test data
const testProjects: Project[] = [
  {
    id: "jupiter",
    name: "Jupiter",
    category: "defi" as const,
    description: "Leading DEX aggregator on Solana",
    metrics: { tvl: 500_000_000, volume24h: 100_000_000 },
    evidenceIds: ["ev-001", "ev-002"],
    chain: "solana",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "marinade",
    name: "Marinade Finance",
    category: "defi" as const,
    description: "Liquid staking protocol for Solana",
    metrics: { tvl: 2_000_000_000 },
    evidenceIds: ["ev-003"],
    chain: "solana",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const testEvidence: Evidence[] = [
  {
    id: "ev-001",
    source: { id: "helius", name: "Helius" },
    note: "Jupiter TVL verified on-chain",
    status: "verified",
    observedAt: "2026-01-01T00:00:00.000Z",
    reference: "https://solscan.io/tx/abc",
    chain: "solana",
  },
  {
    id: "ev-002",
    source: { id: "coingecko", name: "CoinGecko" },
    note: "Jupiter 24h volume",
    status: "verified",
    observedAt: "2026-01-01T00:00:00.000Z",
    chain: "solana",
  },
  {
    id: "ev-003",
    source: { id: "defillama", name: "DeFiLlama" },
    note: "Marinade staked SOL",
    status: "pending",
    observedAt: "2026-01-01T00:00:00.000Z",
    chain: "solana",
  },
];

const testNarratives: Narrative[] = [
  {
    id: "n-001",
    name: "Liquid Staking Growth",
    trend: "up",
    change: "+15%",
    note: "Liquid staking TVL is growing",
    projectIds: ["marinade"],
    evidenceIds: ["ev-003"],
  },
  {
    id: "n-002",
    name: "DEX Aggregation",
    trend: "flat",
    note: "DEX aggregator volumes are stable",
    projectIds: ["jupiter"],
    evidenceIds: ["ev-002"],
  },
];

const testReport: Report = {
  id: "r-001",
  lens: "ecosystem",
  title: "Solana Ecosystem Overview",
  sections: {
    thesis: "The Solana ecosystem is healthy",
    catalyst: "Growing TVL",
    risk: "Concentration risk",
  },
  evidenceIds: ["ev-001", "ev-002", "ev-003"],
  confidence: "medium",
  generatedAt: "2026-01-01T00:00:00.000Z",
  isDemo: false,
};

function createMockDataSource(
  projects = testProjects,
  evidence = testEvidence,
  narratives = testNarratives,
  report = testReport,
): InsightDataSource {
  return {
    async listProjects() {
      return projects;
    },
    async resolveEvidenceIds(ids: readonly string[]) {
      return evidence.filter((e) => ids.includes(e.id));
    },
    async getNarratives() {
      return narratives;
    },
    async getReport() {
      return report;
    },
  };
}

describe("ContextRetriever", () => {
  let retriever: ContextRetriever;

  beforeEach(() => {
    retriever = new ContextRetriever(createMockDataSource());
  });

  it("retrieves projects matching keywords", async () => {
    const ctx = await retriever.retrieve("Tell me about Jupiter");
    expect(ctx.projects.length).toBeGreaterThan(0);
    expect(ctx.projects[0]?.id).toBe("jupiter");
  });

  it("retrieves all projects when no keyword match", async () => {
    const ctx = await retriever.retrieve("ecosystem overview");
    expect(ctx.projects.length).toBe(2);
  });

  it("retrieves evidence from matched projects", async () => {
    const ctx = await retriever.retrieve("Tell me about Jupiter");
    // Jupiter has 2 evidence IDs, Marinade has 1 — both are returned
    expect(ctx.evidence.length).toBeGreaterThanOrEqual(2);
    expect(ctx.evidence.some((e) => e.id === "ev-001")).toBe(true);
  });

  it("retrieves narratives matching keywords", async () => {
    const ctx = await retriever.retrieve("liquid staking growth");
    // Both narratives match "growth" or "staking" keywords
    expect(ctx.narratives.length).toBeGreaterThanOrEqual(1);
    expect(ctx.narratives.some((n) => n.id === "n-001")).toBe(true);
  });

  it("includes the ecosystem report", async () => {
    const ctx = await retriever.retrieve("ecosystem report");
    expect(ctx.reports.length).toBe(1);
    expect(ctx.reports[0]?.id).toBe("r-001");
  });

  it("hasSufficientData is true when projects exist", async () => {
    const ctx = await retriever.retrieve("anything");
    expect(ctx.hasSufficientData).toBe(true);
  });

  it("hasSufficientData is false when no data", async () => {
    const emptySource = createMockDataSource([], [], [], undefined);
    retriever = new ContextRetriever(emptySource);
    const ctx = await retriever.retrieve("anything");
    expect(ctx.hasSufficientData).toBe(false);
    expect(ctx.summary).toContain("no sufficient data");
  });

  it("respects maxProjects limit", async () => {
    const ctx = await retriever.retrieve("ecosystem", { maxProjects: 1 });
    expect(ctx.projects.length).toBe(1);
  });

  it("respects maxEvidence limit", async () => {
    const ctx = await retriever.retrieve("jupiter", { maxEvidence: 1 });
    expect(ctx.evidence.length).toBe(1);
  });

  it("builds a summary string", async () => {
    const ctx = await retriever.retrieve("jupiter");
    expect(ctx.summary).toContain("2 projects");
    expect(ctx.summary).toContain("evidence items");
    expect(ctx.summary).toContain("narratives");
  });
});

describe("serializeContext", () => {
  it("produces valid JSON with expected fields", async () => {
    const retriever = new ContextRetriever(createMockDataSource());
    const ctx = await retriever.retrieve("jupiter");
    const json = serializeContext(ctx);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty("projects");
    expect(parsed).toHaveProperty("evidence");
    expect(parsed).toHaveProperty("narratives");
    expect(parsed).toHaveProperty("reports");
    expect(parsed).toHaveProperty("graph");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("hasSufficientData");
    expect(parsed.projects[0]).toHaveProperty("id", "jupiter");
    expect(parsed.evidence[0]).toHaveProperty("id", "ev-001");
  });

  it("keeps evidence fields bounded", async () => {
    const retriever = new ContextRetriever(createMockDataSource());
    const ctx = await retriever.retrieve("jupiter", { maxEvidence: 1 });
    const json = serializeContext(ctx);
    const parsed = JSON.parse(json);
    expect(parsed.evidence.length).toBe(1);
  });
});
