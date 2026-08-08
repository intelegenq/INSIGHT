import { describe, expect, it } from "vitest";
import type { DataProvider, ProviderFetch, RawEvidence, RawNarrative, RawProject } from "../../src";
import { SourceHealthMonitor, checkSourceHealth, staticFetch } from "../../src";

const CHECKED_AT = "2026-08-08T00:00:00.000Z";

class HealthProvider implements DataProvider {
  constructor(
    readonly id: string,
    readonly name: string,
    private readonly available: boolean,
  ) {}

  fetchProjects(): Promise<ProviderFetch<RawProject>> {
    return staticFetch([]);
  }

  fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    return staticFetch([]);
  }

  fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    return staticFetch([]);
  }

  async health() {
    return {
      id: this.id,
      name: this.name,
      available: this.available,
      note: this.available ? "provider healthy" : "provider unavailable",
    };
  }
}

class ThrowingHealthProvider extends HealthProvider {
  override async health() {
    throw new Error("health endpoint failed");
  }
}

describe("SourceHealthMonitor", () => {
  it("returns a deterministic healthy report", async () => {
    const report = await checkSourceHealth(
      [new HealthProvider("zeta", "Zeta", true), new HealthProvider("alpha", "Alpha", true)],
      { checkedAt: CHECKED_AT },
    );

    expect(report).toEqual({
      status: "healthy",
      checkedAt: CHECKED_AT,
      providers: [
        {
          id: "alpha",
          name: "Alpha",
          available: true,
          note: "provider healthy",
          status: "healthy",
        },
        {
          id: "zeta",
          name: "Zeta",
          available: true,
          note: "provider healthy",
          status: "healthy",
        },
      ],
      summary: {
        total: 2,
        healthy: 2,
        unavailable: 0,
      },
    });
  });

  it("reports degraded when only some sources are available", async () => {
    const monitor = new SourceHealthMonitor([
      new HealthProvider("healthy", "Healthy", true),
      new HealthProvider("down", "Down", false),
    ]);

    const report = await monitor.check({ checkedAt: CHECKED_AT });

    expect(report.status).toBe("degraded");
    expect(report.summary).toEqual({ total: 2, healthy: 1, unavailable: 1 });
  });

  it("converts thrown health checks into unavailable entries", async () => {
    const report = await checkSourceHealth([new ThrowingHealthProvider("broken", "Broken", true)], {
      checkedAt: CHECKED_AT,
    });

    expect(report.status).toBe("unavailable");
    expect(report.providers[0]).toMatchObject({
      id: "broken",
      available: false,
      note: "health endpoint failed",
      status: "unavailable",
    });
  });
});
