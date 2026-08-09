import { describe, expect, it, beforeEach } from "vitest";
import { AssistantService } from "../src/assistant/AssistantService";
import { MockProvider } from "../src/providers/AIGateway";
import type { AIProvider, AIRequest, AIResponse } from "../src/types";
import type { InsightDataSource } from "../src/context/ContextRetriever";
import type { Project, Evidence, Narrative, Report } from "@insight/core";

// Failing provider for testing fallback behavior
class FailingProvider implements AIProvider {
  readonly id = "failing";
  readonly available = false;
  async complete(): Promise<AIResponse> {
    throw new Error("Provider unavailable");
  }
}

// Test data (same as context-retrieval tests)
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

function createMockDataSource(): InsightDataSource {
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
  };
}

describe("AssistantService", () => {
  let service: AssistantService;

  beforeEach(() => {
    const provider = new MockProvider();
    const dataSource = createMockDataSource();
    service = new AssistantService(provider, dataSource);
  });

  it("returns a structured response with answer and citations", async () => {
    const response = await service.answer("Tell me about Jupiter");
    expect(response.answer).toBeDefined();
    expect(response.answer.length).toBeGreaterThan(0);
    expect(response.citations.length).toBe(1);
    expect(response.citations[0]?.evidenceId).toBe("ev-001");
    expect(response.citations[0]?.source).toBe("helius");
    expect(response.citations[0]?.status).toBe("verified");
  });

  it("propagates project references", async () => {
    const response = await service.answer("Tell me about Jupiter");
    expect(response.projects.length).toBe(1);
    expect(response.projects[0]?.id).toBe("jupiter");
    expect(response.projects[0]?.name).toBe("Jupiter");
  });

  it("propagates narrative references", async () => {
    const response = await service.answer("DEX aggregation");
    expect(response.narratives.length).toBe(1);
    expect(response.narratives[0]?.id).toBe("n-001");
  });

  it("propagates report references", async () => {
    const response = await service.answer("ecosystem");
    expect(response.reports.length).toBe(1);
    expect(response.reports[0]?.id).toBe("r-001");
  });

  it("metadata has correct fields", async () => {
    const response = await service.answer("ecosystem");
    expect(response.metadata.providerUsed).toBe(true);
    expect(response.metadata.providerName).toBe("mock");
    expect(response.metadata.hasSufficientData).toBe(true);
    expect(response.metadata.contextSize).toBeGreaterThan(0);
    expect(response.metadata.timestamp).toBeDefined();
  });

  it("returns insufficient data response when no projects match", async () => {
    const emptySource: InsightDataSource = {
      async listProjects() {
        return [];
      },
      async resolveEvidenceIds() {
        return [];
      },
      async getNarratives() {
        return [];
      },
      async getReport() {
        return undefined;
      },
    };
    const service = new AssistantService(new MockProvider(), emptySource);
    const response = await service.answer("anything");
    expect(response.metadata.hasSufficientData).toBe(false);
    expect(response.metadata.providerUsed).toBe(false);
    expect(response.citations).toEqual([]);
    expect(response.projects).toEqual([]);
  });

  it("falls back to deterministic answer when provider fails", async () => {
    const service = new AssistantService(new FailingProvider(), createMockDataSource());
    const response = await service.answer("Tell me about Jupiter");
    expect(response.metadata.providerUsed).toBe(false);
    expect(response.metadata.providerName).toBe("fallback");
    expect(response.answer).toContain("Jupiter");
    expect(response.citations.length).toBe(1);
  });

  it("returns insufficient response for empty question", async () => {
    const response = await service.answer("");
    expect(response.metadata.hasSufficientData).toBe(false);
    expect(response.answer).toContain("Please provide a question");
  });

  it("returns insufficient response for whitespace-only question", async () => {
    const response = await service.answer("   ");
    expect(response.metadata.hasSufficientData).toBe(false);
  });
});
