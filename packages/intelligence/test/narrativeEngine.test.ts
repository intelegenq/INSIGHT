import { describe, expect, it } from "vitest";
import type { Evidence, Project } from "@insight/core";
import {
  deriveCategoryNarrative,
  deriveNarrativeForProject,
  deriveNarratives,
} from "../src/engines/narrativeEngine";
import { DEFAULT_BOUNDS } from "../src/engines/projectHealthEngine";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";
const DEFAULTS = { referenceDate: REFERENCE_DATE, bounds: DEFAULT_BOUNDS };

function project(overrides: Partial<Project> & Pick<Project, "id" | "name">): Project {
  return {
    category: "defi",
    description: "",
    metrics: { developerActivity: 20 },
    evidenceIds: ["e1"],
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}

function evidence(id: string, status: Evidence["status"]): Evidence {
  return {
    id,
    source: { id: id, name: id },
    note: id,
    status,
    observedAt: "2026-08-06T00:00:00.000Z",
  };
}

describe("NarrativeEngine", () => {
  describe("deriveNarratives", () => {
    it("groups projects by category into separate narratives", () => {
      const evidenceById = new Map<string, Evidence>([
        ["e1", evidence("e1", "verified")],
        ["e2", evidence("e2", "verified")],
      ]);
      const projects = [
        project({ id: "p1", name: "Lending", category: "defi", evidenceIds: ["e1"] }),
        project({ id: "p2", name: "Compiler", category: "infrastructure", evidenceIds: ["e2"] }),
      ];

      const result = deriveNarratives(projects, evidenceById, DEFAULTS);

      expect(result).toHaveLength(2);
      const names = result.map((item) => item.narrative.name);
      expect(names).toContain("DeFi");
      expect(names).toContain("Infrastructure");
    });

    it("collects project and evidence ids", () => {
      const evidenceById = new Map<string, Evidence>([["e1", evidence("e1", "verified")]]);
      const projects = [project({ id: "p1", name: "Lending", evidenceIds: ["e1"] })];

      const result = deriveNarratives(projects, evidenceById, DEFAULTS);

      expect(result[0]?.narrative.projectIds).toEqual(["p1"]);
      expect(result[0]?.narrative.evidenceIds).toEqual(["e1"]);
      expect(result[0]?.momentum).toBeTypeOf("number");
    });

    it("uses the up trend when momentum is high", () => {
      const evidenceById = new Map<string, Evidence>([
        ["e1", evidence("e1", "verified")],
        ["e2", evidence("e2", "verified")],
      ]);
      const strong = project({
        id: "p1",
        name: "Strong",
        metrics: { developerActivity: 50 },
        evidenceIds: ["e1", "e2"],
      });

      const result = deriveNarratives([strong], evidenceById, DEFAULTS);
      const trend = result[0]?.narrative.trend;

      expect(["up", "down", "flat"]).toContain(trend);
    });
  });

  describe("deriveCategoryNarrative", () => {
    it("names the narrative after its category", () => {
      const result = deriveCategoryNarrative("defi", [], new Map(), DEFAULTS);

      expect(result.narrative.name).toBe("DeFi");
      expect(result.momentum).toBe(0);
    });
  });

  describe("deriveNarrativeForProject", () => {
    it("builds a single-project narrative with backing evidence", () => {
      const ev = [evidence("e1", "verified")];
      const result = deriveNarrativeForProject(
        project({ id: "p1", name: "Lending" }),
        ev,
        DEFAULTS,
      );

      expect(result.narrative.id).toBe("narrative-p1");
      expect(result.narrative.projectIds).toEqual(["p1"]);
      expect(result.narrative.evidenceIds).toEqual(["e1"]);
    });
  });
});
