import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph } from "../src/builder";
import type { Evidence, Narrative, Project } from "@insight/core";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";

function project(overrides: Partial<Project> & Pick<Project, "id" | "name">): Project {
  return {
    category: "defi",
    description: "",
    metrics: { tvl: 100_000_000 },
    evidenceIds: [],
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}

function evidence(id: string, status: Evidence["status"]): Evidence {
  return {
    id,
    source: { id: "source-telemetry", name: "Telemetry" },
    note: id,
    status,
    observedAt: "2026-08-06T00:00:00.000Z",
  };
}

function narrative(overrides: Partial<Narrative> & Pick<Narrative, "id" | "name">): Narrative {
  return {
    trend: "up",
    note: "",
    projectIds: [],
    evidenceIds: [],
    ...overrides,
  };
}

describe("buildKnowledgeGraph", () => {
  it("creates entities for projects, evidence, sources, and narratives", () => {
    const graph = buildKnowledgeGraph({
      projects: [project({ id: "p1", name: "Lending" })],
      evidence: [evidence("e1", "verified")],
      narratives: [narrative({ id: "n1", name: "DeFi" })],
    });

    expect(graph.entities.get("p1")?.kind).toBe("project");
    expect(graph.entities.get("e1")?.kind).toBe("evidence");
    expect(graph.entities.get("source-telemetry")?.kind).toBe("source");
    expect(graph.entities.get("n1")?.kind).toBe("narrative");
  });

  it("creates evidence->source relationships", () => {
    const graph = buildKnowledgeGraph({
      projects: [],
      evidence: [evidence("e1", "verified")],
      narratives: [],
    });

    const rel = graph.relationships.find((edge) => edge.type === "sources");
    expect(rel?.from).toBe("e1");
    expect(rel?.to).toBe("source-telemetry");
  });

  it("creates project->evidence, narrative->project, narrative->evidence edges", () => {
    const graph = buildKnowledgeGraph({
      projects: [project({ id: "p1", name: "Lending", evidenceIds: ["e1"] })],
      evidence: [evidence("e1", "verified")],
      narratives: [narrative({ id: "n1", name: "DeFi", projectIds: ["p1"], evidenceIds: ["e1"] })],
    });

    expect(
      graph.relationships.some((r) => r.type === "backs" && r.from === "p1" && r.to === "e1"),
    ).toBe(true);
    expect(
      graph.relationships.some((r) => r.type === "features" && r.from === "n1" && r.to === "p1"),
    ).toBe(true);
    expect(
      graph.relationships.some((r) => r.type === "supports" && r.from === "n1" && r.to === "e1"),
    ).toBe(true);
  });

  it("is deterministic: same input produces identical graph", () => {
    const input = {
      projects: [project({ id: "p1", name: "Lending", evidenceIds: ["e1"] })],
      evidence: [evidence("e1", "verified")],
      narratives: [narrative({ id: "n1", name: "DeFi", projectIds: ["p1"] })],
    };

    const first = buildKnowledgeGraph(input);
    const second = buildKnowledgeGraph(input);

    expect(first.relationships).toEqual(second.relationships);
    expect([...first.entities.keys()]).toEqual([...second.entities.keys()]);
  });

  it("sorts relationships canonically", () => {
    const graph = buildKnowledgeGraph({
      projects: [
        project({ id: "p-b", name: "B", evidenceIds: ["e1"] }),
        project({ id: "p-a", name: "A", evidenceIds: ["e1"] }),
      ],
      evidence: [evidence("e1", "verified")],
      narratives: [],
    });

    const froms = graph.relationships.map((r) => r.from);
    expect([...froms].sort()).toEqual(froms);
  });

  it("assigns verified evidence higher edge weight than demo", () => {
    const verifiedGraph = buildKnowledgeGraph({
      projects: [],
      evidence: [evidence("e1", "verified")],
      narratives: [],
    });
    const demoGraph = buildKnowledgeGraph({
      projects: [],
      evidence: [evidence("e1", "demo")],
      narratives: [],
    });

    const verifiedWeight =
      verifiedGraph.relationships.find((r) => r.type === "sources")?.weight ?? 0;
    const demoWeight = demoGraph.relationships.find((r) => r.type === "sources")?.weight ?? 0;
    expect(verifiedWeight).toBeGreaterThan(demoWeight);
  });
});
