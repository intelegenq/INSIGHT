import { describe, expect, it } from "vitest";
import { AssistantService } from "../src/assistant/AssistantService";
import { MockProvider } from "../src/providers/AIGateway";
import type { AIProvider, AIRequest, AIResponse } from "../src/types";
import type { ExtendedInsightDataSource } from "../src/context/ContextRetriever";
import type { Project, Evidence, Narrative, Report } from "@insight/core";

// Failing provider for testing fallback behavior
class FailingProvider implements AIProvider {
  readonly id = "failing";
  readonly available = false;
  async complete(): Promise<AIResponse> {
    throw new Error("Provider unavailable");
  }
}

// Test data
const testProjects: Project[] = [
  {
    id: "jupiter",
    name: "Jupiter",
    category: "defi" as const,
    description: "Leading DEX aggregator on Solana",
    metrics: { tvl: 500_000_000, volume24h: 100_000_000 },
    evidenceIds: ["ev-001"],
    chain: "solana",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "raydium",
    name: "Raydium",
    category: "defi" as const,
    description: "AMM and liquidity provider on Solana",
    metrics: { tvl: 300_000_000, volume24h: 50_000_000 },
    evidenceIds: ["ev-002"],
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
    source: { id: "defillama", name: "DeFiLlama" },
    note: "Raydium TVL from DeFiLlama",
    status: "verified",
    observedAt: "2026-01-01T00:00:00.000Z",
    chain: "solana",
  },
];

const testNarratives: Narrative[] = [
  {
    id: "n-001",
    name: "DEX Aggregation",
    trend: "up",
    change: "+10%",
    note: "DEX volume is growing",
    projectIds: ["jupiter"],
    evidenceIds: ["ev-001"],
  },
];

const testReport: Report = {
  id: "r-001",
  lens: "ecosystem",
  title: "Solana Ecosystem Overview",
  sections: { thesis: "Healthy ecosystem", catalyst: "Growing TVL", risk: "Concentration" },
  evidenceIds: ["ev-001"],
  confidence: "medium",
  generatedAt: "2026-01-01T00:00:00.000Z",
  isDemo: false,
};

function createExtendedDataSource(): ExtendedInsightDataSource {
  return {
    async listProjects() {
      return testProjects;
    },
    async resolveEvidenceIds(ids: readonly string[]) {
      return testEvidence.filter((e) => ids.includes(e.id));
    },
    async getNarratives() {
      return testNarratives;
    },
    async getReport() {
      return testReport;
    },
    async getProjectHealth(projectId: string) {
      if (projectId === "jupiter") return { health: 75, momentum: 20, risk: 25, developer: 15 };
      if (projectId === "raydium") return { health: 60, momentum: 10, risk: 35, developer: 12 };
      return undefined;
    },
    async getPulse() {
      return {
        totalProjects: testProjects.length,
        totalNarratives: testNarratives.length,
        totalEvidence: testEvidence.length,
        generatedAt: "2026-01-01T00:00:00.000Z",
      };
    },
    async listSnapshots() {
      return [
        {
          id: "snap-1",
          referenceDate: "2026-01-01T00:00:00.000Z",
          projectCount: 2,
          narrativeCount: 1,
          evidenceCount: 2,
        },
      ];
    },
  };
}

describe("AI Assistant — completed path", () => {
  it("returns grounded answer with health scores, pulse, and snapshots", async () => {
    const provider = new MockProvider();
    const dataSource = createExtendedDataSource();
    const assistant = new AssistantService(provider, dataSource);
    const response = await assistant.answer("What is the health of Jupiter?");

    expect(response.answer).toBeTruthy();
    expect(response.metadata.providerUsed).toBe(true);
    expect(response.metadata.providerName).toBe("mock");
    expect(response.metadata.hasSufficientData).toBe(true);
    expect(response.projects.length).toBeGreaterThan(0);
    expect(response.healthScores.length).toBeGreaterThan(0);
    expect(response.healthScores[0]!.projectName).toBe("Jupiter");
    expect(response.healthScores[0]!.health).toBe(75);
    expect(response.pulse).not.toBeNull();
    expect(response.pulse!.totalProjects).toBe(2);
    expect(response.snapshotCount).toBe(1);
  });

  it("returns graph entities in the response", async () => {
    const provider = new MockProvider();
    const dataSource = createExtendedDataSource();
    const graphSource = {
      async getKnowledgeGraph() {
        return {
          entities: new Map([
            ["e1", { kind: "project", id: "e1", name: "Jupiter" }],
            ["e2", { kind: "narrative", id: "e2", name: "DEX Aggregation" }],
          ]) as Map<string, { kind: string; id: string; name?: string }>,
          adjacency: new Map(),
          relationships: [{ from: "e1", to: "e2", type: "part_of" }],
        } as any;
      },
    };
    const assistant = new AssistantService(provider, dataSource, graphSource as any);
    const response = await assistant.answer("What does the knowledge graph show?");

    expect(response.graphEntities.length).toBeGreaterThan(0);
    expect(response.graphEntities[0]!.kind).toBe("project");
  });

  it("falls back to deterministic answer when provider fails", async () => {
    const provider = new FailingProvider();
    const dataSource = createExtendedDataSource();
    const assistant = new AssistantService(provider, dataSource);
    const response = await assistant.answer("What projects are in the ecosystem?");

    expect(response.metadata.providerUsed).toBe(false);
    expect(response.metadata.providerName).toBe("fallback");
    expect(response.answer).toContain("Regarding");
    expect(response.projects.length).toBeGreaterThan(0);
  });

  it("returns insufficient data response for empty question", async () => {
    const provider = new MockProvider();
    const dataSource = createExtendedDataSource();
    const assistant = new AssistantService(provider, dataSource);
    const response = await assistant.answer("");

    expect(response.metadata.hasSufficientData).toBe(false);
    expect(response.metadata.providerUsed).toBe(false);
    expect(response.answer).toContain("Please provide");
  });

  it("includes citations from evidence", async () => {
    const provider = new MockProvider();
    const dataSource = createExtendedDataSource();
    const assistant = new AssistantService(provider, dataSource);
    const response = await assistant.answer("What evidence supports Jupiter?");

    expect(response.citations.length).toBeGreaterThan(0);
    expect(response.citations[0]!.evidenceId).toBe("ev-001");
    expect(response.citations[0]!.source).toBeTruthy();
  });

  it("context includes health scores in serialized context", async () => {
    const provider = new MockProvider();
    const dataSource = createExtendedDataSource();
    const assistant = new AssistantService(provider, dataSource);
    const response = await assistant.answer("Compare project health");

    expect(response.healthScores.length).toBe(2);
    expect(response.healthScores.some((h) => h.projectName === "Jupiter")).toBe(true);
    expect(response.healthScores.some((h) => h.projectName === "Raydium")).toBe(true);
  });

  it("pulse data is included in response when available", async () => {
    const provider = new MockProvider();
    const dataSource = createExtendedDataSource();
    const assistant = new AssistantService(provider, dataSource);
    const response = await assistant.answer("What is the ecosystem overview?");

    expect(response.pulse).not.toBeNull();
    expect(response.pulse!.totalProjects).toBe(2);
    expect(response.pulse!.totalEvidence).toBe(2);
  });

  it("snapshot count is included in response", async () => {
    const provider = new MockProvider();
    const dataSource = createExtendedDataSource();
    const assistant = new AssistantService(provider, dataSource);
    const response = await assistant.answer("How has the ecosystem changed?");

    expect(response.snapshotCount).toBe(1);
  });

  it("extended data source methods are optional — falls back to basic", async () => {
    const provider = new MockProvider();
    const basicDataSource = {
      async listProjects() {
        return testProjects;
      },
      async resolveEvidenceIds(ids: readonly string[]) {
        return testEvidence.filter((e) => ids.includes(e.id));
      },
      async getNarratives() {
        return testNarratives;
      },
      async getReport() {
        return testReport;
      },
    };
    const assistant = new AssistantService(provider, basicDataSource);
    const response = await assistant.answer("What projects exist?");

    expect(response.metadata.hasSufficientData).toBe(true);
    expect(response.healthScores).toHaveLength(0);
    expect(response.pulse).toBeNull();
    expect(response.snapshotCount).toBe(0);
  });
});
