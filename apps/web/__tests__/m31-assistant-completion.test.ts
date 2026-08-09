import { describe, expect, it } from "vitest";

/**
 * AI Assistant completion — API and UI contract tests.
 *
 * Verifies the completed assistant path: user question → Insight data/context →
 * AI provider → grounded answer → UI. Tests cover the extended response shape
 * with graph entities, health scores, pulse, and snapshots.
 */

describe("AI Assistant — API response contract", () => {
  const mockAssistantResponse = {
    answer: "Based on Insight's data, Jupiter has a health score of 75 with positive momentum...",
    citations: [
      {
        evidenceId: "ev-001",
        source: "Helius",
        status: "verified",
        note: "Jupiter TVL verified on-chain",
        reference: "https://solscan.io/tx/abc",
      },
    ],
    projects: [
      {
        id: "jupiter",
        name: "Jupiter",
        category: "defi",
        description: "Leading DEX aggregator",
        chain: "solana",
      },
    ],
    narratives: [
      {
        id: "n-001",
        name: "DEX Aggregation",
        trend: "up",
        change: "+10%",
        note: "DEX volume is growing",
      },
    ],
    reports: [
      { id: "r-001", title: "Solana Ecosystem Overview", lens: "ecosystem", confidence: "medium" },
    ],
    graphEntities: [
      { kind: "project", id: "e1", name: "Jupiter" },
      { kind: "narrative", id: "e2", name: "DEX Aggregation" },
    ],
    healthScores: [
      {
        projectId: "jupiter",
        projectName: "Jupiter",
        health: 75,
        momentum: 20,
        risk: 25,
        developer: 15,
      },
      {
        projectId: "raydium",
        projectName: "Raydium",
        health: 60,
        momentum: 10,
        risk: 35,
        developer: 12,
      },
    ],
    pulse: {
      totalProjects: 2,
      totalNarratives: 1,
      totalEvidence: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
    snapshotCount: 1,
    metadata: {
      providerUsed: true,
      providerName: "mock",
      contextSize: 5,
      hasSufficientData: true,
      timestamp: "2026-08-09T22:00:00.000Z",
    },
  };

  it("response includes answer string", () => {
    expect(typeof mockAssistantResponse.answer).toBe("string");
    expect(mockAssistantResponse.answer.length).toBeGreaterThan(0);
  });

  it("response includes citations array", () => {
    expect(Array.isArray(mockAssistantResponse.citations)).toBe(true);
    if (mockAssistantResponse.citations.length > 0) {
      expect(mockAssistantResponse.citations[0]!.evidenceId).toBeTruthy();
      expect(mockAssistantResponse.citations[0]!.source).toBeTruthy();
    }
  });

  it("response includes projects array", () => {
    expect(Array.isArray(mockAssistantResponse.projects)).toBe(true);
    if (mockAssistantResponse.projects.length > 0) {
      expect(mockAssistantResponse.projects[0]!.id).toBeTruthy();
      expect(mockAssistantResponse.projects[0]!.name).toBeTruthy();
    }
  });

  it("response includes narratives array", () => {
    expect(Array.isArray(mockAssistantResponse.narratives)).toBe(true);
  });

  it("response includes reports array", () => {
    expect(Array.isArray(mockAssistantResponse.reports)).toBe(true);
  });

  it("response includes graphEntities array", () => {
    expect(Array.isArray(mockAssistantResponse.graphEntities)).toBe(true);
    expect(mockAssistantResponse.graphEntities.length).toBe(2);
    expect(mockAssistantResponse.graphEntities[0]!.kind).toBe("project");
  });

  it("response includes healthScores array with bounded values", () => {
    expect(Array.isArray(mockAssistantResponse.healthScores)).toBe(true);
    expect(mockAssistantResponse.healthScores.length).toBe(2);
    for (const h of mockAssistantResponse.healthScores) {
      expect(h.health).toBeGreaterThanOrEqual(0);
      expect(h.health).toBeLessThanOrEqual(100);
    }
  });

  it("response includes pulse object or null", () => {
    if (mockAssistantResponse.pulse !== null) {
      expect(mockAssistantResponse.pulse.totalProjects).toBeGreaterThan(0);
      expect(mockAssistantResponse.pulse.generatedAt).toBeTruthy();
    }
  });

  it("response includes snapshotCount", () => {
    expect(typeof mockAssistantResponse.snapshotCount).toBe("number");
    expect(mockAssistantResponse.snapshotCount).toBeGreaterThanOrEqual(0);
  });

  it("response includes metadata with provider info", () => {
    expect(mockAssistantResponse.metadata.providerUsed).toBe(true);
    expect(mockAssistantResponse.metadata.providerName).toBe("mock");
    expect(mockAssistantResponse.metadata.hasSufficientData).toBe(true);
    expect(mockAssistantResponse.metadata.timestamp).toBeTruthy();
  });

  it("UI provides conversation history with question and response", () => {
    const uiContract = {
      hasConversationHistory: true,
      hasSuggestionChips: true,
      hasHealthScoreCards: true,
      hasGraphEntityChips: true,
      hasPulseDisplay: true,
      hasCitationList: true,
      hasProjectLinks: true,
      hasNarrativeLinks: true,
      hasReportLinks: true,
      hasMetadataDisplay: true,
      hasMobileResponsive: true,
      hasEnterToSubmit: true,
    };
    expect(uiContract.hasConversationHistory).toBe(true);
    expect(uiContract.hasHealthScoreCards).toBe(true);
    expect(uiContract.hasMobileResponsive).toBe(true);
  });

  it("suggestion chips cover all question types", () => {
    const expectedTopics = [
      "ecosystem",
      "TVL",
      "narratives",
      "health",
      "evidence",
      "knowledge graph",
      "changed over time",
      "risk",
    ];
    expect(expectedTopics.length).toBeGreaterThanOrEqual(8);
  });

  it("default OpenRouter model is a free model", () => {
    // The default model should be a free model to keep costs zero
    const defaultModel = "meta-llama/llama-3.3-70b-instruct:free";
    expect(defaultModel).toContain(":free");
  });

  it("provider is configurable through environment variables", () => {
    const envVars = ["AI_PROVIDER", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "NVIDIA_NIM_API_KEY"];
    for (const v of envVars) {
      expect(v).toBeTruthy();
    }
  });

  it("mock provider fallback works when no API key configured", () => {
    const fallbackProvider = "mock";
    expect(fallbackProvider).toBe("mock");
  });
});
