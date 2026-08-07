import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph } from "../src/builder";
import {
  resolveEntities,
  resolveEntity,
  resolveNeighborhood,
  resolveRelationships,
  resolveSubgraph,
} from "../src/resolver";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";

function project(
  id: string,
  name: string,
  evidenceIds: string[] = [],
): import("@insight/core").Project {
  return {
    id,
    name,
    category: "defi",
    description: "",
    metrics: { tvl: 100_000_000 },
    evidenceIds,
    updatedAt: REFERENCE_DATE,
  };
}

function evidence(
  id: string,
  sourceId = "source-telemetry",
  status: import("@insight/core").Evidence["status"] = "verified",
) {
  return {
    id,
    source: { id: sourceId, name: sourceId },
    note: id,
    status,
    observedAt: "2026-08-06T00:00:00.000Z",
  };
}

function narrative(id: string, name: string, projectIds: string[] = []) {
  return { id, name, trend: "up" as const, note: "", projectIds, evidenceIds: [] };
}

describe("GraphResolver", () => {
  const graph = buildKnowledgeGraph({
    projects: [project("p1", "Lending", ["e1"]), project("p2", "RPC", ["e2"])],
    evidence: [evidence("e1"), evidence("e2", "s-other")],
    narratives: [narrative("n1", "DeFi", ["p1"])],
  });

  describe("resolveEntity", () => {
    it("resolves an entity with its typed neighborhood", () => {
      const resolved = resolveEntity(graph, "p1");

      expect(resolved?.entity.kind).toBe("project");
      expect(resolved?.outbound.map((e) => e.to)).toContain("e1");
    });

    it("returns undefined for an unknown id", () => {
      expect(resolveEntity(graph, "missing")).toBeUndefined();
    });
  });

  describe("resolveEntities", () => {
    it("filters by kind", () => {
      const projects = resolveEntities(graph, { kind: "project" });

      expect(projects.map((e) => e.kind)).toEqual(["project", "project"]);
      expect(projects.map((e) => e.id)).toEqual(["p1", "p2"]);
    });

    it("filters by ids", () => {
      const result = resolveEntities(graph, { ids: ["p2"] });

      expect(result.map((e) => e.id)).toEqual(["p2"]);
    });
  });

  describe("resolveRelationships", () => {
    it("filters by type", () => {
      const backs = resolveRelationships(graph, { type: "backs" });

      expect(backs.every((r) => r.type === "backs")).toBe(true);
      expect(backs).toHaveLength(2);
    });

    it("filters by from and to", () => {
      const edges = resolveRelationships(graph, { fromId: "p1", toId: "e1" });

      expect(edges).toHaveLength(1);
      expect(edges[0]?.type).toBe("backs");
    });
  });

  describe("resolveSubgraph", () => {
    it("induces a graph over the given ids", () => {
      const sub = resolveSubgraph(graph, ["p1", "e1"]);

      expect(sub.entities.has("p1")).toBe(true);
      expect(sub.entities.has("e1")).toBe(true);
      expect(sub.entities.has("p2")).toBe(false);
      expect(sub.relationships).toHaveLength(1);
    });
  });

  describe("resolveNeighborhood", () => {
    it("resolves entities reachable within depth", () => {
      const entities = resolveNeighborhood(graph, "n1", { maxDepth: 2 });

      expect(entities.map((e) => e.id)).toContain("n1");
      expect(entities.map((e) => e.id)).toContain("p1");
    });
  });
});
