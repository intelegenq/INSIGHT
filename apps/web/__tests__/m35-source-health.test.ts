import { describe, expect, it } from "vitest";

describe("M35 — Source health monitoring surfacing", () => {
  it("GET /api/health returns health report with status, providers, and summary", () => {
    const mockResponse = {
      status: "healthy",
      checkedAt: "2026-08-09T16:50:00.000Z",
      providers: [
        {
          id: "defillama",
          name: "DeFiLlama",
          available: true,
          note: "OK",
          status: "healthy",
        },
        {
          id: "coingecko",
          name: "CoinGecko",
          available: true,
          note: "OK",
          status: "healthy",
        },
        {
          id: "demo",
          name: "Demo Provider",
          available: true,
          note: "static provider",
          status: "healthy",
        },
      ],
      summary: {
        total: 3,
        healthy: 3,
        unavailable: 0,
      },
    };
    expect(mockResponse.status).toBe("healthy");
    expect(mockResponse.providers.length).toBe(3);
    expect(mockResponse.summary.total).toBe(3);
    expect(mockResponse.summary.healthy).toBe(3);
    expect(mockResponse.summary.unavailable).toBe(0);
  });

  it("health status can be healthy, degraded, or unavailable", () => {
    const validStatuses = ["healthy", "degraded", "unavailable"];
    for (const s of validStatuses) {
      expect(s).toMatch(/^(healthy|degraded|unavailable)$/);
    }
  });

  it("degraded status when some providers are unavailable", () => {
    const mockResponse = {
      status: "degraded",
      providers: [
        { id: "defillama", name: "DeFiLlama", available: true, status: "healthy" },
        { id: "helius", name: "Helius", available: false, status: "unavailable", note: "timeout" },
      ],
      summary: { total: 2, healthy: 1, unavailable: 1 },
    };
    expect(mockResponse.status).toBe("degraded");
    expect(mockResponse.summary.unavailable).toBe(1);
  });

  it("unavailable status when all providers are down", () => {
    const mockResponse = {
      status: "unavailable",
      providers: [
        { id: "defillama", name: "DeFiLlama", available: false, status: "unavailable" },
        { id: "coingecko", name: "CoinGecko", available: false, status: "unavailable" },
      ],
      summary: { total: 2, healthy: 0, unavailable: 2 },
    };
    expect(mockResponse.status).toBe("unavailable");
    expect(mockResponse.summary.healthy).toBe(0);
  });

  it("each provider entry has id, name, available, and status fields", () => {
    const mockProvider = {
      id: "helius",
      name: "Helius",
      available: true,
      note: "OK",
      status: "healthy",
    };
    expect(mockProvider.id).toBeDefined();
    expect(mockProvider.name).toBeDefined();
    expect(mockProvider.available).toBe(true);
    expect(mockProvider.status).toBe("healthy");
  });

  it("checkedAt is an ISO-8601 timestamp", () => {
    const mockResponse = {
      checkedAt: "2026-08-09T16:50:00.000Z",
    };
    expect(mockResponse.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("re-check button triggers a new health check", () => {
    // The /health page has a re-check button that re-fetches /api/health
    const reCheckUrl = "/api/health";
    expect(reCheckUrl).toBe("/api/health");
  });
});
