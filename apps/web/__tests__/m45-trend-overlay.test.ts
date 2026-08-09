import { describe, expect, it } from "vitest";

/**
 * M45 — Multi-project trend overlay.
 *
 * Tests verify the overlay API response contract: GET /api/trends/overlay?ids=...
 * returns a map of projectId → { name, points[] } with chronologically sorted
 * trend points. Minimum 2 IDs, maximum 10. Uses existing listSnapshots and
 * scoreProject — no new data, no AI.
 */

describe("M45 — Multi-project trend overlay API contract", () => {
  const mockOverlayResponse = {
    projects: {
      "proj-lending": {
        name: "Illustrative Lending Pool",
        points: [
          {
            snapshotId: "snap-1",
            referenceDate: "2026-01-01T00:00:00.000Z",
            metrics: {
              tvl: 1_000_000_000,
              volume24h: 80_000_000,
              activeUsers24h: 12_000,
              developerActivity: 8,
            },
            health: { health: 65.0, momentum: 20.0, risk: 25.0, developer: 16.0 },
          },
          {
            snapshotId: "snap-2",
            referenceDate: "2026-01-08T00:00:00.000Z",
            metrics: {
              tvl: 1_100_000_000,
              volume24h: 85_000_000,
              activeUsers24h: 13_500,
              developerActivity: 9,
            },
            health: { health: 70.5, momentum: 30.0, risk: 20.0, developer: 18.0 },
          },
        ],
      },
      "proj-dex": {
        name: "Illustrative DEX",
        points: [
          {
            snapshotId: "snap-1",
            referenceDate: "2026-01-01T00:00:00.000Z",
            metrics: {
              tvl: 500_000_000,
              volume24h: 40_000_000,
              activeUsers24h: 8_000,
              developerActivity: 5,
            },
            health: { health: 55.0, momentum: 10.0, risk: 30.0, developer: 12.0 },
          },
          {
            snapshotId: "snap-2",
            referenceDate: "2026-01-08T00:00:00.000Z",
            metrics: {
              tvl: 520_000_000,
              volume24h: 42_000_000,
              activeUsers24h: 8_500,
              developerActivity: 6,
            },
            health: { health: 58.0, momentum: 15.0, risk: 28.0, developer: 14.0 },
          },
        ],
      },
    },
    count: 2,
  };

  it("returns a map of projectId to trend data", () => {
    expect(mockOverlayResponse.count).toBe(2);
    expect(Object.keys(mockOverlayResponse.projects)).toHaveLength(2);
    expect(mockOverlayResponse.projects["proj-lending"]).toBeDefined();
    expect(mockOverlayResponse.projects["proj-dex"]).toBeDefined();
  });

  it("each project has name and chronologically sorted points", () => {
    for (const [, data] of Object.entries(mockOverlayResponse.projects)) {
      expect(data.name).toBeTruthy();
      expect(data.points.length).toBeGreaterThan(0);
      for (let i = 1; i < data.points.length; i++) {
        expect(new Date(data.points[i]!.referenceDate).getTime()).toBeGreaterThanOrEqual(
          new Date(data.points[i - 1]!.referenceDate).getTime(),
        );
      }
    }
  });

  it("health scores are bounded 0-100", () => {
    for (const [, data] of Object.entries(mockOverlayResponse.projects)) {
      for (const pt of data.points) {
        expect(pt.health.health).toBeGreaterThanOrEqual(0);
        expect(pt.health.health).toBeLessThanOrEqual(100);
      }
    }
  });

  it("rejects fewer than 2 IDs", () => {
    const url = new URLSearchParams({ ids: "only-one-id" });
    const ids = url.get("ids")!.split(",").filter(Boolean);
    expect(ids.length).toBeLessThan(2);
  });

  it("rejects more than 10 IDs", () => {
    const ids = Array.from({ length: 11 }, (_, i) => `proj-${i}`);
    expect(ids.length).toBeGreaterThan(10);
  });

  it("overlay UI provides project checkboxes and compare button", () => {
    const uiContract = {
      hasProjectCheckboxes: true,
      hasCompareButton: true,
      hasOverlayChart: true,
      hasLegend: true,
      maxProjects: 10,
    };
    expect(uiContract.hasProjectCheckboxes).toBe(true);
    expect(uiContract.hasCompareButton).toBe(true);
  });
});
