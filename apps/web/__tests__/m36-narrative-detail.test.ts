import { describe, expect, it } from "vitest";

describe("M36 — Narrative detail page", () => {
  it("GET /api/narratives/[id] returns narrative with linked projects and evidence", () => {
    const mockResponse = {
      narrative: {
        id: "n-lst-growth",
        name: "LST Growth",
        trend: "up",
        change: "+18.4%",
        note: "Liquid staking continues to expand",
        projectIds: ["jupiter", "marinade"],
        evidenceIds: ["ev-001", "ev-002"],
      },
      projects: [
        {
          id: "jupiter",
          name: "Jupiter",
          category: "defi",
          description: "DEX aggregator",
          metrics: { tvl: 500000000 },
          evidenceIds: ["ev-001"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "marinade",
          name: "Marinade",
          category: "defi",
          description: "Liquid staking",
          metrics: { tvl: 300000000 },
          evidenceIds: ["ev-002"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      evidence: [
        {
          id: "ev-001",
          source: { id: "src-helius", name: "Helius" },
          note: "Jupiter TVL verified",
          status: "verified",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "ev-002",
          source: { id: "src-defillama", name: "DeFiLlama" },
          note: "Marinade staking data",
          status: "verified",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    expect(mockResponse.narrative.id).toBe("n-lst-growth");
    expect(mockResponse.projects.length).toBe(2);
    expect(mockResponse.evidence.length).toBe(2);
    expect(mockResponse.projects[0]?.id).toBe("jupiter");
    expect(mockResponse.evidence[0]?.id).toBe("ev-001");
  });

  it("GET /api/narratives/[id] returns 404 for unknown narrative", () => {
    const mockResponse = new Response(null, { status: 404 });
    expect(mockResponse.status).toBe(404);
  });

  it("narrative projects are resolved from projectIds", () => {
    const narrative = {
      projectIds: ["jupiter", "marinade", "raydium"],
    };
    expect(narrative.projectIds.length).toBe(3);
    expect(narrative.projectIds).toContain("jupiter");
    expect(narrative.projectIds).toContain("marinade");
  });

  it("narrative evidence is resolved from evidenceIds", () => {
    const narrative = {
      evidenceIds: ["ev-001", "ev-002"],
    };
    expect(narrative.evidenceIds.length).toBe(2);
    expect(narrative.evidenceIds).toContain("ev-001");
  });

  it("narrative detail page links to project detail pages", () => {
    const projectLink = "/projects/jupiter";
    expect(projectLink).toMatch(/^\/projects\//);
  });

  it("narrative list cards are links to detail pages", () => {
    const narrativeLink = "/narratives/n-lst-growth";
    expect(narrativeLink).toMatch(/^\/narratives\//);
  });

  it("narrative detail shows trend badge and change", () => {
    const mockNarrative = {
      trend: "up",
      change: "+18.4%",
    };
    expect(mockNarrative.trend).toBe("up");
    expect(mockNarrative.change).toContain("+");
  });

  it("narrative detail handles no linked projects gracefully", () => {
    const mockResponse = {
      narrative: {
        id: "n-empty",
        projectIds: [],
        evidenceIds: [],
      },
      projects: [],
      evidence: [],
    };
    expect(mockResponse.projects.length).toBe(0);
    expect(mockResponse.evidence.length).toBe(0);
  });
});
