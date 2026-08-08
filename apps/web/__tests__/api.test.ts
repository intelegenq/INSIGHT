import { describe, expect, it, beforeEach } from "vitest";
import { GET as listProjects } from "../app/api/projects/route";
import { GET as getReports } from "../app/api/reports/route";
import { GET as listSnapshots, POST as createSnapshot } from "../app/api/snapshots/route";
import { GET as getHistory } from "../app/api/history/route";
import { InsightService, getInsightService, resetInsightService } from "../lib/insight-service";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

describe("API routes", () => {
  beforeEach(() => {
    resetInsightService();
  });

  describe("GET /api/projects", () => {
    it("returns the expected shape", async () => {
      const response = await listProjects(new Request("http://localhost/api/projects"));
      expect(response.status).toBe(200);
      const body = await readJson<{ projects: unknown[]; count: number }>(response);
      expect(Array.isArray(body.projects)).toBe(true);
      expect(typeof body.count).toBe("number");
      expect(body.count).toBe(body.projects.length);
    });
  });

  describe("GET /api/reports", () => {
    it("returns the ecosystem report by default", async () => {
      const request = new Request("http://localhost/api/reports");
      const response = await getReports(request);
      expect(response.status).toBe(200);
      const body = await readJson<{ report: { lens: string }; lens: string }>(response);
      expect(body.lens).toBe("ecosystem");
    });

    it("rejects an invalid lens with 400", async () => {
      const request = new Request("http://localhost/api/reports?lens=bogus");
      const response = await getReports(request);
      expect(response.status).toBe(400);
      const body = await readJson<{ error: { message: string } }>(response);
      expect(body.error.message).toMatch(/lens must be one of: ecosystem, defi, infrastructure/);
    });
  });

  describe("GET /api/snapshots", () => {
    it("returns empty list initially", async () => {
      const response = await listSnapshots(new Request("http://localhost/api/snapshots"));
      expect(response.status).toBe(200);
      const body = await readJson<{ snapshots: unknown[]; count: number }>(response);
      expect(body.snapshots).toEqual([]);
      expect(body.count).toBe(0);
    });
  });

  describe("POST /api/snapshots", () => {
    it("creates a snapshot and returns 201", async () => {
      const response = await createSnapshot(
        new Request("http://localhost/api/snapshots", { method: "POST" }),
      );
      expect(response.status).toBe(201);
      const body = await readJson<{ snapshot: { id: string; referenceDate: string } }>(response);
      expect(typeof body.snapshot.id).toBe("string");
      expect(typeof body.snapshot.referenceDate).toBe("string");
    });

    it("persists the snapshot so subsequent GET returns it", async () => {
      await createSnapshot(new Request("http://localhost/api/snapshots", { method: "POST" }));
      const list = await listSnapshots(new Request("http://localhost/api/snapshots"));
      const body = await readJson<{ count: number }>(list);
      expect(body.count).toBe(1);
    });
  });

  describe("GET /api/history", () => {
    it("rejects missing query params with 400", async () => {
      const request = new Request("http://localhost/api/history");
      const response = await getHistory(request);
      expect(response.status).toBe(400);
    });

    it("returns 404 when snapshots are not found", async () => {
      const request = new Request("http://localhost/api/history?from=a&to=b");
      const response = await getHistory(request);
      expect(response.status).toBe(404);
    });

    it("returns a diff when both snapshots exist", async () => {
      // Seed two distinct snapshots via the shared singleton (the API
      // route handlers read from the same instance).
      const service = getInsightService();
      service.snapshotAt("2026-01-01T00:00:00.000Z");
      service.snapshotAt("2026-01-02T00:00:00.000Z");
      const list = await listSnapshots(new Request("http://localhost/api/snapshots"));
      const body = await readJson<{ snapshots: { id: string }[] }>(list);
      const ids = body.snapshots.map((s) => s.id);
      const request = new Request(`http://localhost/api/history?from=${ids[0]}&to=${ids[1]}`);
      const response = await getHistory(request);
      expect(response.status).toBe(200);
      const diff = await readJson<{ diff: { fromId: string; toId: string } }>(response);
      expect(diff.diff.fromId).toBe(ids[0]);
      expect(diff.diff.toId).toBe(ids[1]);
    });
  });
});
