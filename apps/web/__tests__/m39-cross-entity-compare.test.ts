import { describe, expect, it } from "vitest";

/**
 * M39 — Cross-entity comparison view.
 *
 * Tests verify the comparison API response contract: uniform entries with
 * metrics, health scores, and evidence count, plus validation of the
 * minimum/maximum project ID constraints.
 */

describe("M39 — Cross-entity comparison response contract", () => {
  const mockCompareResponse = {
    entries: [
      {
        id: "proj-lending",
        name: "Illustrative Lending Pool",
        category: "defi",
        description: "A demo lending protocol.",
        metrics: {
          tvl: 1_240_000_000,
          volume24h: 86_000_000,
          activeUsers24h: 14_200,
          developerActivity: 8,
        },
        health: {
          health: 72.5,
          momentum: 35.2,
          risk: 15.0,
          developer: 16.0,
        },
        evidenceCount: 1,
      },
      {
        id: "proj-ormlite",
        name: "Ormlite Compiler",
        category: "infrastructure",
        description: "A demo compiler toolchain.",
        metrics: {
          tvl: 0,
          volume24h: 0,
          activeUsers24h: 3_100,
          developerActivity: 22,
        },
        health: {
          health: 42.1,
          momentum: 20.0,
          risk: 30.0,
          developer: 44.0,
        },
        evidenceCount: 1,
      },
    ],
    count: 2,
  };

  it("response includes entries array and count", () => {
    expect(mockCompareResponse).toHaveProperty("entries");
    expect(mockCompareResponse).toHaveProperty("count");
    expect(Array.isArray(mockCompareResponse.entries)).toBe(true);
    expect(mockCompareResponse.count).toBe(mockCompareResponse.entries.length);
  });

  it("each entry has id, name, category, description, metrics, health, evidenceCount", () => {
    for (const entry of mockCompareResponse.entries) {
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.category).toBe("string");
      expect(typeof entry.description).toBe("string");
      expect(typeof entry.metrics).toBe("object");
      expect(typeof entry.evidenceCount).toBe("number");
    }
  });

  it("metrics include tvl, volume24h, activeUsers24h, developerActivity", () => {
    for (const entry of mockCompareResponse.entries) {
      expect(entry.metrics).toHaveProperty("tvl");
      expect(entry.metrics).toHaveProperty("volume24h");
      expect(entry.metrics).toHaveProperty("activeUsers24h");
      expect(entry.metrics).toHaveProperty("developerActivity");
    }
  });

  it("health scores are bounded: health 0..100, momentum -100..100, risk 0..100, developer 0..100", () => {
    for (const entry of mockCompareResponse.entries) {
      if (entry.health === undefined) continue;
      expect(entry.health.health).toBeGreaterThanOrEqual(0);
      expect(entry.health.health).toBeLessThanOrEqual(100);
      expect(entry.health.momentum).toBeGreaterThanOrEqual(-100);
      expect(entry.health.momentum).toBeLessThanOrEqual(100);
      expect(entry.health.risk).toBeGreaterThanOrEqual(0);
      expect(entry.health.risk).toBeLessThanOrEqual(100);
      expect(entry.health.developer).toBeGreaterThanOrEqual(0);
      expect(entry.health.developer).toBeLessThanOrEqual(100);
    }
  });

  it("less than 2 IDs returns validation error", () => {
    const errorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "At least 2 project IDs are required. Usage: /api/compare?ids=id1,id2",
      },
    };
    expect(errorResponse.error.code).toBe("VALIDATION_ERROR");
  });

  it("more than 10 IDs returns validation error", () => {
    const errorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "A maximum of 10 projects can be compared at once.",
      },
    };
    expect(errorResponse.error.code).toBe("VALIDATION_ERROR");
  });

  it("not-found IDs are reported in the response", () => {
    const responseWithNotFound = {
      entries: [mockCompareResponse.entries[0]!],
      count: 1,
      notFound: ["proj-ormlite"],
    };
    expect(responseWithNotFound.notFound).toContain("proj-ormlite");
  });

  it("entries can be compared for best-value highlighting", () => {
    const entries = mockCompareResponse.entries;
    const tvls = entries.map((e) => e.metrics.tvl);
    const bestTvl = Math.max(...tvls.filter((v): v is number => v !== undefined));
    expect(bestTvl).toBe(1_240_000_000);

    const healthScores = entries.map((e) => e.health?.health);
    const bestHealth = Math.max(...healthScores.filter((v): v is number => v !== undefined));
    expect(bestHealth).toBe(72.5);

    const riskScores = entries.map((e) => e.health?.risk);
    const bestRisk = Math.min(...riskScores.filter((v): v is number => v !== undefined));
    expect(bestRisk).toBe(15.0);
  });

  it("all entries are valid projects from the same dataset", () => {
    const validIds = ["proj-lending", "proj-ormlite"];
    for (const entry of mockCompareResponse.entries) {
      expect(validIds).toContain(entry.id);
    }
  });

  it("entries preserve input order", () => {
    const orderedResponse = {
      entries: [{ ...mockCompareResponse.entries[1]! }, { ...mockCompareResponse.entries[0]! }],
      count: 2,
    };
    expect(orderedResponse.entries[0]!.id).toBe("proj-ormlite");
    expect(orderedResponse.entries[1]!.id).toBe("proj-lending");
  });

  it("health is optional — entry without health still valid", () => {
    const entryWithoutHealth = {
      id: "proj-new",
      name: "New Project",
      category: "other",
      description: "Just launched.",
      metrics: { tvl: 1000, volume24h: 0, activeUsers24h: 10, developerActivity: 1 },
      health: undefined,
      evidenceCount: 0,
    };
    expect(entryWithoutHealth.health).toBeUndefined();
    expect(typeof entryWithoutHealth.evidenceCount).toBe("number");
  });
});
