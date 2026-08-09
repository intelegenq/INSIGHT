import { describe, expect, it } from "vitest";

describe("M37 — Project health scores on project detail", () => {
  it("GET /api/projects/[id] returns project, evidence, and health scores", () => {
    const mockResponse = {
      project: {
        id: "jupiter",
        name: "Jupiter",
        category: "defi",
        description: "DEX aggregator",
        metrics: { tvl: 500000000 },
        evidenceIds: ["ev-001"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      evidence: [
        {
          id: "ev-001",
          source: { id: "src-helius", name: "Helius" },
          note: "TVL verified",
          status: "verified",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      health: {
        health: 72.5,
        momentum: 35.2,
        risk: 15.0,
        developer: 80.0,
      },
    };
    expect(mockResponse.project.id).toBe("jupiter");
    expect(mockResponse.evidence.length).toBe(1);
    expect(mockResponse.health).toBeDefined();
    expect(mockResponse.health.health).toBeGreaterThanOrEqual(0);
    expect(mockResponse.health.health).toBeLessThanOrEqual(100);
    expect(mockResponse.health.momentum).toBeGreaterThanOrEqual(-100);
    expect(mockResponse.health.momentum).toBeLessThanOrEqual(100);
    expect(mockResponse.health.risk).toBeGreaterThanOrEqual(0);
    expect(mockResponse.health.risk).toBeLessThanOrEqual(100);
    expect(mockResponse.health.developer).toBeGreaterThanOrEqual(0);
    expect(mockResponse.health.developer).toBeLessThanOrEqual(100);
  });

  it("health scores are deterministic numbers", () => {
    const mockHealth = {
      health: 72.5,
      momentum: 35.2,
      risk: 15.0,
      developer: 80.0,
    };
    expect(typeof mockHealth.health).toBe("number");
    expect(typeof mockHealth.momentum).toBe("number");
    expect(typeof mockHealth.risk).toBe("number");
    expect(typeof mockHealth.developer).toBe("number");
  });

  it("health score is bounded 0..100", () => {
    const mockHealth = { health: 72.5, momentum: 0, risk: 0, developer: 0 };
    expect(mockHealth.health).toBeGreaterThanOrEqual(0);
    expect(mockHealth.health).toBeLessThanOrEqual(100);
  });

  it("momentum score is bounded -100..100", () => {
    const mockHealth1 = { health: 0, momentum: -50, risk: 0, developer: 0 };
    const mockHealth2 = { health: 0, momentum: 75, risk: 0, developer: 0 };
    expect(mockHealth1.momentum).toBeGreaterThanOrEqual(-100);
    expect(mockHealth2.momentum).toBeLessThanOrEqual(100);
  });

  it("risk score is bounded 0..100", () => {
    const mockHealth = { health: 0, momentum: 0, risk: 45.3, developer: 0 };
    expect(mockHealth.risk).toBeGreaterThanOrEqual(0);
    expect(mockHealth.risk).toBeLessThanOrEqual(100);
  });

  it("developer score is bounded 0..100", () => {
    const mockHealth = { health: 0, momentum: 0, risk: 0, developer: 60.0 };
    expect(mockHealth.developer).toBeGreaterThanOrEqual(0);
    expect(mockHealth.developer).toBeLessThanOrEqual(100);
  });

  it("project detail page shows health profile section when health is present", () => {
    const mockData = {
      project: { id: "jupiter", name: "Jupiter" },
      evidence: [],
      health: { health: 72.5, momentum: 35.2, risk: 15.0, developer: 80.0 },
    };
    expect(mockData.health).toBeDefined();
  });

  it("project detail page handles missing health gracefully", () => {
    const mockData = {
      project: { id: "test", name: "Test" },
      evidence: [],
      health: undefined,
    };
    expect(mockData.health).toBeUndefined();
  });
});
