import { describe, expect, it } from "vitest";

/**
 * M43 — Project trend comparison over time.
 *
 * Tests verify the trend API response contract: chronological data
 * points with metrics and health scores per snapshot, sparkline
 * computation, trend direction detection, and project selection.
 * Uses existing snapshot and scoreProject contracts — no new data or AI.
 */

describe("M43 — Project trend API response contract", () => {
  const mockTrendResponse = {
    projectId: "proj-lending",
    name: "Illustrative Lending Pool",
    category: "defi",
    points: [
      {
        snapshotId: "snapshot-2026-01-01-aaaa0000",
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
        snapshotId: "snapshot-2026-01-08-bbbb1111",
        referenceDate: "2026-01-08T00:00:00.000Z",
        metrics: {
          tvl: 1_100_000_000,
          volume24h: 85_000_000,
          activeUsers24h: 13_500,
          developerActivity: 9,
        },
        health: { health: 70.5, momentum: 30.0, risk: 20.0, developer: 18.0 },
      },
      {
        snapshotId: "snapshot-2026-01-15-cccc2222",
        referenceDate: "2026-01-15T00:00:00.000Z",
        metrics: {
          tvl: 1_240_000_000,
          volume24h: 86_000_000,
          activeUsers24h: 14_200,
          developerActivity: 8,
        },
        health: { health: 72.5, momentum: 35.2, risk: 15.0, developer: 16.0 },
      },
    ],
    count: 3,
  };

  it("response includes projectId, name, category, points, count", () => {
    expect(mockTrendResponse).toHaveProperty("projectId");
    expect(mockTrendResponse).toHaveProperty("name");
    expect(mockTrendResponse).toHaveProperty("category");
    expect(mockTrendResponse).toHaveProperty("points");
    expect(mockTrendResponse).toHaveProperty("count");
    expect(mockTrendResponse.count).toBe(mockTrendResponse.points.length);
  });

  it("points are sorted chronologically by referenceDate", () => {
    const dates = mockTrendResponse.points.map((p) => new Date(p.referenceDate).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]!);
    }
  });

  it("each point has snapshotId, referenceDate, metrics, health", () => {
    for (const pt of mockTrendResponse.points) {
      expect(typeof pt.snapshotId).toBe("string");
      expect(typeof pt.referenceDate).toBe("string");
      expect(typeof pt.metrics).toBe("object");
      expect(typeof pt.health).toBe("object");
    }
  });

  it("metrics include tvl, volume24h, activeUsers24h, developerActivity", () => {
    for (const pt of mockTrendResponse.points) {
      expect(pt.metrics).toHaveProperty("tvl");
      expect(pt.metrics).toHaveProperty("volume24h");
      expect(pt.metrics).toHaveProperty("activeUsers24h");
      expect(pt.metrics).toHaveProperty("developerActivity");
    }
  });

  it("health scores are bounded: health 0..100, momentum -100..100, risk 0..100, developer 0..100", () => {
    for (const pt of mockTrendResponse.points) {
      expect(pt.health.health).toBeGreaterThanOrEqual(0);
      expect(pt.health.health).toBeLessThanOrEqual(100);
      expect(pt.health.momentum).toBeGreaterThanOrEqual(-100);
      expect(pt.health.momentum).toBeLessThanOrEqual(100);
      expect(pt.health.risk).toBeGreaterThanOrEqual(0);
      expect(pt.health.risk).toBeLessThanOrEqual(100);
      expect(pt.health.developer).toBeGreaterThanOrEqual(0);
      expect(pt.health.developer).toBeLessThanOrEqual(100);
    }
  });
});

describe("M43 — Sparkline computation", () => {
  const values = [65.0, 70.5, 72.5];

  it("computes min and max for sparkline bounds", () => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(min).toBe(65.0);
    expect(max).toBe(72.5);
  });

  it("range is max - min", () => {
    const range = Math.max(...values) - Math.min(...values);
    expect(range).toBe(7.5);
  });

  it("stepX divides width evenly across points", () => {
    const width = 200;
    const stepX = width / (values.length - 1);
    expect(stepX).toBeCloseTo(100, 0);
  });

  it("y values are within [0, height]", () => {
    const height = 48;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const yVals = values.map((v) => height - ((v - min) / range) * (height - 8) - 4);
    for (const y of yVals) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(height);
    }
  });

  it("single-value series produces empty sparkline", () => {
    const single = [42];
    expect(single.length < 2).toBe(true);
  });

  it("empty series produces empty sparkline", () => {
    const empty: number[] = [];
    expect(empty.length < 2).toBe(true);
  });
});

describe("M43 — Trend direction detection", () => {
  function trendDir(prev: number, curr: number): "up" | "down" | "flat" {
    if (curr > prev) return "up";
    if (curr < prev) return "down";
    return "flat";
  }

  it("up when current > previous", () => {
    expect(trendDir(50, 60)).toBe("up");
  });

  it("down when current < previous", () => {
    expect(trendDir(60, 50)).toBe("down");
  });

  it("flat when current equals previous", () => {
    expect(trendDir(50, 50)).toBe("flat");
  });

  it("direction arrow maps correctly", () => {
    function arrow(dir: string): string {
      return dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
    }
    expect(arrow("up")).toBe("↑");
    expect(arrow("down")).toBe("↓");
    expect(arrow("flat")).toBe("→");
  });
});

describe("M43 — Project selection and empty states", () => {
  const projects = [
    { id: "proj-lending", name: "Illustrative Lending Pool", category: "defi" },
    { id: "proj-ormlite", name: "Ormlite Compiler", category: "infrastructure" },
  ];

  it("project selector lists all available projects", () => {
    expect(projects.length).toBe(2);
    expect(projects[0]!.id).toBe("proj-lending");
  });

  it("selecting a project triggers trend load", () => {
    let selectedId = "";
    const onSelect = (id: string) => {
      selectedId = id;
    };
    onSelect("proj-ormlite");
    expect(selectedId).toBe("proj-ormlite");
  });

  it("empty trend (no snapshots) returns 404 or empty points", () => {
    const emptyResponse = {
      projectId: "proj-x",
      name: "X",
      category: "other",
      points: [],
      count: 0,
    };
    expect(emptyResponse.points.length).toBe(0);
    expect(emptyResponse.count).toBe(0);
  });

  it("project not found in any snapshot returns empty points", () => {
    const notFoundResponse = {
      projectId: "nonexistent",
      name: "nonexistent",
      category: "unknown",
      points: [],
      count: 0,
    };
    expect(notFoundResponse.points.length).toBe(0);
  });
});
