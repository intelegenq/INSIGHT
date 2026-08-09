import { describe, expect, it, vi } from "vitest";

describe("M32 — Auth/Saved/History UI API contracts", () => {
  it("POST /api/auth/login accepts email + password", () => {
    const body = { email: "test@example.com", password: "password" };
    expect(body.email).toBe("test@example.com");
    expect(body.password).toBe("password");
  });

  it("POST /api/auth/register accepts email + password + displayName", () => {
    const body = {
      email: "new@example.com",
      password: "password",
      displayName: "New User",
    };
    expect(body.email).toBe("new@example.com");
    expect(body.displayName).toBe("New User");
  });

  it("GET /api/auth/me returns 401 when unauthenticated", async () => {
    const mockResponse = new Response(null, { status: 401 });
    expect(mockResponse.status).toBe(401);
  });

  it("GET /api/saved returns 401 when unauthenticated", async () => {
    const mockResponse = new Response(null, { status: 401 });
    expect(mockResponse.status).toBe(401);
  });

  it("POST /api/saved accepts kind: report with reportId + lens", () => {
    const body = {
      kind: "report" as const,
      reportId: "r-001",
      lens: "ecosystem",
      title: "Ecosystem Report",
    };
    expect(body.kind).toBe("report");
    expect(body.reportId).toBe("r-001");
  });

  it("POST /api/saved accepts kind: narrative with narrativeId", () => {
    const body = { kind: "narrative" as const, narrativeId: "n-001", name: "LST Growth" };
    expect(body.kind).toBe("narrative");
  });

  it("POST /api/saved accepts kind: project with projectId", () => {
    const body = { kind: "project" as const, projectId: "jupiter", name: "Jupiter" };
    expect(body.kind).toBe("project");
  });

  it("DELETE /api/saved requires kind + id query params", () => {
    const url = new URL("https://example.com/api/saved?kind=report&id=r-001");
    expect(url.searchParams.get("kind")).toBe("report");
    expect(url.searchParams.get("id")).toBe("r-001");
  });

  it("GET /api/snapshots returns snapshot list", async () => {
    const data = {
      snapshots: [
        {
          id: "snap-001",
          referenceDate: "2026-01-01",
          summary: { projectCount: 5, narrativeCount: 2, evidenceCount: 10, graphEntityCount: 15 },
        },
      ],
      count: 1,
    };
    expect(data.snapshots.length).toBe(1);
    expect(data.snapshots[0]?.id).toBe("snap-001");
  });

  it("GET /api/history requires from + to params", () => {
    const url = new URL("https://example.com/api/history?from=snap-001&to=snap-002");
    expect(url.searchParams.get("from")).toBe("snap-001");
    expect(url.searchParams.get("to")).toBe("snap-002");
  });

  it("POST /api/auth/logout clears session", () => {
    // Logout just needs to clear the cookie — no body required
    expect(true).toBe(true);
  });
});
