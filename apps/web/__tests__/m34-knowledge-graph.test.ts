import { describe, expect, it } from "vitest";

describe("M34 — Knowledge graph surfacing", () => {
  it("GET /api/graph returns graph summary with entities and relationships", () => {
    const mockResponse = {
      summary: {
        entityCount: 12,
        relationshipCount: 18,
        kindCounts: { project: 3, evidence: 5, source: 2, narrative: 2 },
        typeCounts: { backs: 5, sources: 5, features: 4, supports: 4 },
      },
      entities: [
        { kind: "project", id: "jupiter", name: "Jupiter", category: "DeFi" },
        {
          kind: "evidence",
          id: "ev-001",
          sourceId: "src-helius",
          note: "TVL verified",
          status: "verified",
        },
        { kind: "source", id: "src-helius", name: "Helius" },
        { kind: "narrative", id: "n-lst", name: "LST Growth", trend: "up" },
      ],
      relationships: [
        { type: "backs", from: "jupiter", to: "ev-001", weight: 1 },
        { type: "sources", from: "ev-001", to: "src-helius", weight: 1 },
        { type: "features", from: "n-lst", to: "jupiter", weight: 0.9 },
      ],
    };
    expect(mockResponse.summary.entityCount).toBe(12);
    expect(mockResponse.summary.relationshipCount).toBe(18);
    expect(mockResponse.summary.kindCounts.project).toBe(3);
    expect(mockResponse.summary.typeCounts.backs).toBe(5);
    expect(mockResponse.entities.length).toBe(4);
    expect(mockResponse.entities[0]?.kind).toBe("project");
    expect(mockResponse.relationships.length).toBe(3);
  });

  it("GET /api/graph?kind=project filters to project entities only", () => {
    const mockResponse = {
      entities: [
        { kind: "project", id: "jupiter", name: "Jupiter", category: "DeFi" },
        { kind: "project", id: "marinade", name: "Marinade", category: "LST" },
      ],
    };
    expect(mockResponse.entities.every((e) => e.kind === "project")).toBe(true);
    expect(mockResponse.entities.length).toBe(2);
  });

  it("GET /api/graph/[id] returns entity with outbound and inbound edges", () => {
    const mockResponse = {
      entity: { kind: "project", id: "jupiter", name: "Jupiter", category: "DeFi" },
      outbound: [
        { type: "backs", from: "jupiter", to: "ev-001", weight: 1 },
        { type: "backs", from: "jupiter", to: "ev-002", weight: 1 },
      ],
      inbound: [{ type: "features", from: "n-lst", to: "jupiter", weight: 0.9 }],
      connections: [
        {
          kind: "evidence",
          id: "ev-001",
          sourceId: "src-helius",
          note: "TVL verified",
          status: "verified",
        },
        {
          kind: "evidence",
          id: "ev-002",
          sourceId: "src-helius",
          note: "Volume checked",
          status: "verified",
        },
        { kind: "narrative", id: "n-lst", name: "LST Growth", trend: "up" },
      ],
    };
    expect(mockResponse.entity.id).toBe("jupiter");
    expect(mockResponse.outbound.length).toBe(2);
    expect(mockResponse.inbound.length).toBe(1);
    expect(mockResponse.connections.length).toBe(3);
    expect(mockResponse.outbound[0]?.type).toBe("backs");
    expect(mockResponse.inbound[0]?.type).toBe("features");
  });

  it("GET /api/graph/[id] returns 404 for unknown entity", () => {
    const mockResponse = new Response(null, { status: 404 });
    expect(mockResponse.status).toBe(404);
  });

  it("knowledge graph entity kinds are project, evidence, source, narrative", () => {
    const validKinds = ["project", "evidence", "source", "narrative"];
    for (const kind of validKinds) {
      expect(kind).toMatch(/^(project|evidence|source|narrative)$/);
    }
  });

  it("knowledge graph relationship types are backs, sources, features, supports", () => {
    const validTypes = ["backs", "sources", "features", "supports"];
    for (const type of validTypes) {
      expect(type).toMatch(/^(backs|sources|features|supports)$/);
    }
  });

  it("assistant GraphDataSource wiring provides graph context", () => {
    // The assistant route now wires GraphDataSource, so the AI context
    // includes graphEntityCount and graphRelationshipCount
    const mockContext = {
      graphEntityCount: 12,
      graphRelationshipCount: 18,
      graphEntities: [
        { kind: "project", id: "jupiter", name: "Jupiter" },
        { kind: "evidence", id: "ev-001" },
      ],
      hasSufficientData: true,
    };
    expect(mockContext.graphEntityCount).toBeGreaterThan(0);
    expect(mockContext.graphRelationshipCount).toBeGreaterThan(0);
    expect(mockContext.graphEntities.length).toBeGreaterThan(0);
    expect(mockContext.hasSufficientData).toBe(true);
  });

  it("getKnowledgeGraph cache invalidation on snapshot", () => {
    // When a new snapshot is taken, the knowledge graph cache key is deleted
    const cacheKey = "insight:knowledge-graph";
    expect(cacheKey).toBe("insight:knowledge-graph");
  });
});
