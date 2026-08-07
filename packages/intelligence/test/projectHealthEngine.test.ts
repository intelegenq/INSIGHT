import { describe, expect, it } from "vitest";
import type { Evidence, Project } from "@insight/core";
import { DEFAULT_BOUNDS, scoreProject, scoreProjects } from "../src/engines/projectHealthEngine";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";
const DEFAULTS = { referenceDate: REFERENCE_DATE, bounds: DEFAULT_BOUNDS };

function project(overrides: Partial<Project> & Pick<Project, "id" | "name">): Project {
  return {
    category: "defi",
    description: "",
    metrics: {},
    evidenceIds: [],
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}

function verifiedEvidence(id: string): Evidence {
  return {
    id,
    source: { id: "telemetry", name: "Telemetry" },
    note: "verified signal",
    status: "verified",
    observedAt: "2026-08-06T00:00:00.000Z",
  };
}

describe("ProjectHealthEngine", () => {
  describe("scoreProject", () => {
    it("returns a bounded project health profile", () => {
      const scored = scoreProject(
        project({
          id: "p1",
          name: "Lending",
          metrics: { tvl: 500_000_000, developerActivity: 20 },
        }),
        [verifiedEvidence("e1")],
        DEFAULTS,
      );

      expect(scored.health).toBeGreaterThanOrEqual(0);
      expect(scored.health).toBeLessThanOrEqual(100);
      expect(scored.momentum).toBeGreaterThanOrEqual(-100);
      expect(scored.momentum).toBeLessThanOrEqual(100);
      expect(scored.risk).toBeGreaterThanOrEqual(0);
      expect(scored.risk).toBeLessThanOrEqual(100);
      expect(scored.developer).toBeGreaterThanOrEqual(0);
      expect(scored.developer).toBeLessThanOrEqual(100);
    });

    it("is deterministic for identical inputs", () => {
      const p = project({ id: "p1", name: "Lending", metrics: { tvl: 300_000_000 } });
      const ev = [verifiedClaim("e1")];

      expect(scoreProject(p, ev, DEFAULTS)).toEqual(scoreProject(p, ev, DEFAULTS));
    });

    it("penalizes risk when evidence is missing", () => {
      const withSupport = project({
        id: "p1",
        name: "A",
        metrics: { tvl: 100_000_000 },
        evidenceIds: ["e1"],
      });
      const withoutSupport = project({
        id: "p2",
        name: "B",
        metrics: { tvl: 100_000_000 },
        evidenceIds: ["missing-e1"],
      });

      const supported = scoreProject(withSupport, [verifiedClaim("e1")], DEFAULTS);
      const unsupported = scoreProject(withoutSupport, [], DEFAULTS);

      expect(unsupported.risk).toBeGreaterThan(supported.risk);
    });

    it("scales developer score with activity", () => {
      const low = scoreProject(
        project({ id: "p1", name: "Low", metrics: { developerActivity: 5 } }),
        [],
        DEFAULTS,
      );
      const high = scoreProject(
        project({ id: "p2", name: "High", metrics: { developerActivity: 45 } }),
        [],
        DEFAULTS,
      );

      expect(high.developer).toBeGreaterThan(low.developer);
    });
  });

  describe("scoreProjects", () => {
    it("enriches multiple projects and resolves their evidence", () => {
      const evidenceById = new Map<string, Evidence>([["e1", verifiedClaim("e1")]]);
      const projects = [
        project({ id: "p1", name: "A", evidenceIds: ["e1"] }),
        project({ id: "p2", name: "B", evidenceIds: ["e1"] }),
      ];

      const result = scoreProjects(projects, evidenceById, DEFAULTS);

      expect(result).toHaveLength(2);
      expect(result[0]?.evidence).toHaveLength(1);
      expect(result[0]?.health).toBeDefined();
    });
  });
});

function verifiedClaim(id: string): Evidence {
  return verifiedEvidence(id);
}
