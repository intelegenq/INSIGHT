import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph } from "../src/builder";
import { findPath, inbound, neighbors, subgraph, traverse } from "../src/traversal";

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

function narrative(
  id: string,
  name: string,
  projectIds: string[] = [],
  evidenceIds: string[] = [],
) {
  return { id, name, trend: "up" as const, note: "", projectIds, evidenceIds };
}

describe("GraphTraversal", () => {
  const graph = buildKnowledgeGraph({
    projects: [project("p1", "Lending", ["e1", "e2"]), project("p2", "RPC", ["e2"])],
    evidence: [evidence("e1"), evidence("e2", "s-other")],
    narratives: [narrative("n1", "DeFi", ["p1"], ["e1"])],
  });

  describe("neighbors", () => {
    it("returns outbound edges of a node", () => {
      const edges = neighbors(graph, "p1");

      expect(edges.map((e) => e.to).sort()).toEqual(["e1", "e2"]);
    });

    it("filters by relationship type", () => {
      const edges = neighbors(graph, "n1", { relationshipTypes: ["features"] });

      expect(edges.map((e) => e.to)).toEqual(["p1"]);
    });

    it("returns an empty list for a missing node", () => {
      expect(neighbors(graph, "missing")).toEqual([]);
    });
  });

  describe("inbound", () => {
    it("returns outbound edges pointing at a node", () => {
      const edges = inbound(graph, "e2");

      expect(edges.map((e) => e.from).sort()).toEqual(["p1", "p2"]);
    });

    it("finds the narrative edge that arcs into a project", () => {
      const edges = inbound(graph, "p1");

      expect(edges.map((e) => e.type)).toEqual(["features"]);
      expect(edges.map((e) => e.from)).toEqual(["n1"]);
    });

    it("returns empty for nodes without inbound edges", () => {
      expect(inbound(graph, "p2")).toEqual([]);
    });
  });

  describe("traverse", () => {
    it("visits the origin and immediate neighbors within depth 1", () => {
      const visited = traverse(graph, "p1", { maxDepth: 1 });

      expect(visited).toContain("p1");
      expect(visited).toContain("e1");
      expect(visited).not.toContain("n1");
    });

    it("traverses deeper with a larger maxDepth", () => {
      const visited = traverse(graph, "n1", { maxDepth: 2 });

      expect(visited).toContain("n1");
      expect(visited).toContain("p1");
      expect(visited).toContain("e1");
    });
  });

  describe("findPath", () => {
    it("finds a path between two connected nodes", () => {
      const path = findPath(graph, "p1", "source-telemetry", { maxDepth: 4 });

      expect(path).toBeDefined();
      expect(path?.[0]).toBe("p1");
      expect(path?.[path.length - 1]).toBe("source-telemetry");
      expect(path).toContain("e1");
    });

    it("returns undefined when no path exists", () => {
      expect(findPath(graph, "p1", "p2", { maxDepth: 4 })).toBeUndefined();
    });

    it("returns the single-node path for same origin/target", () => {
      expect(findPath(graph, "p1", "p1")).toEqual(["p1"]);
    });
  });

  describe("subgraph", () => {
    it("keeps only reachable nodes and edges", () => {
      const reachable = subgraph(graph, "p1", { maxDepth: 1 });

      expect(reachable.entities.has("p1")).toBe(true);
      expect(reachable.entities.has("p2")).toBe(false);
    });
  });
});
