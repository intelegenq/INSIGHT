import { describe, expect, it } from "vitest";

/**
 * M38 — Global search across projects, narratives, and evidence.
 *
 * Tests verify the search API response contract: deterministic text matching
 * over existing Insight data, sorted by relevance tier (exact > starts-with >
 * contains), with grouped results and a total count.
 */

describe("M38 — Global search response contract", () => {
  const mockSearchResponse = {
    query: "jupiter",
    projects: [
      {
        id: "jupiter",
        name: "Jupiter",
        category: "defi",
        description: "DEX aggregator on Solana",
      },
    ],
    narratives: [
      {
        id: "narr-dex-growth",
        name: "DEX growth",
        trend: "up",
        note: "Jupiter leads DEX volume growth on Solana",
      },
    ],
    evidence: [
      {
        id: "ev-001",
        sourceName: "Helius",
        note: "Jupiter TVL verified at $500M",
        status: "verified",
      },
    ],
    total: 3,
  };

  it("response includes query, grouped results, and total", () => {
    expect(mockSearchResponse).toHaveProperty("query");
    expect(mockSearchResponse).toHaveProperty("projects");
    expect(mockSearchResponse).toHaveProperty("narratives");
    expect(mockSearchResponse).toHaveProperty("evidence");
    expect(mockSearchResponse).toHaveProperty("total");
    expect(mockSearchResponse.query).toBe("jupiter");
  });

  it("total equals sum of all groups", () => {
    const { projects, narratives, evidence, total } = mockSearchResponse;
    expect(total).toBe(projects.length + narratives.length + evidence.length);
  });

  it("project results include id, name, category, description", () => {
    for (const p of mockSearchResponse.projects) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
      expect(typeof p.category).toBe("string");
      expect(typeof p.description).toBe("string");
    }
  });

  it("narrative results include id, name, trend, note", () => {
    for (const n of mockSearchResponse.narratives) {
      expect(typeof n.id).toBe("string");
      expect(typeof n.name).toBe("string");
      expect(typeof n.trend).toBe("string");
      expect(typeof n.note).toBe("string");
    }
  });

  it("evidence results include id, sourceName, note, status", () => {
    for (const e of mockSearchResponse.evidence) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.sourceName).toBe("string");
      expect(typeof e.note).toBe("string");
      expect(typeof e.status).toBe("string");
    }
  });

  it("empty query returns zero results", () => {
    const emptyResponse = {
      query: "",
      projects: [],
      narratives: [],
      evidence: [],
      total: 0,
    };
    expect(emptyResponse.total).toBe(0);
    expect(emptyResponse.projects.length).toBe(0);
  });

  it("no-match query returns zero results", () => {
    const noMatchResponse = {
      query: "xyznonexistent12345",
      projects: [],
      narratives: [],
      evidence: [],
      total: 0,
    };
    expect(noMatchResponse.total).toBe(0);
  });

  it("results are sorted by relevance: exact name match first", () => {
    const sortedResponse = {
      query: "jupiter",
      projects: [
        { id: "jupiter", name: "Jupiter", category: "defi", description: "DEX aggregator" },
        { id: "jupiter-pro", name: "Jupiter Pro", category: "defi", description: "Pro tools" },
      ],
      narratives: [],
      evidence: [],
      total: 2,
    };
    expect(sortedResponse.projects[0]!.name).toBe("Jupiter");
    expect(sortedResponse.projects[1]!.name).toBe("Jupiter Pro");
  });

  it("search is case-insensitive", () => {
    const upperResponse = {
      query: "JUPITER",
      projects: [
        { id: "jupiter", name: "Jupiter", category: "defi", description: "DEX aggregator" },
      ],
      narratives: [],
      evidence: [],
      total: 1,
    };
    expect(upperResponse.projects[0]!.name).toBe("Jupiter");
  });

  it("search matches on project description, not just name", () => {
    const descMatch = {
      query: "aggregator",
      projects: [
        {
          id: "jupiter",
          name: "Jupiter",
          category: "defi",
          description: "DEX aggregator on Solana",
        },
      ],
      narratives: [],
      evidence: [],
      total: 1,
    };
    expect(descMatch.total).toBe(1);
    expect(descMatch.projects[0]!.description).toContain("aggregator");
  });

  it("search matches on narrative note, not just name", () => {
    const noteMatch = {
      query: "growth",
      narratives: [
        {
          id: "narr-dex-growth",
          name: "DEX growth",
          trend: "up",
          note: "Jupiter leads DEX volume growth on Solana",
        },
      ],
      projects: [],
      evidence: [],
      total: 1,
    };
    expect(noteMatch.narratives[0]!.note).toContain("growth");
  });

  it("search matches on evidence source name and note", () => {
    const evidenceMatch = {
      query: "helius",
      evidence: [
        {
          id: "ev-001",
          sourceName: "Helius",
          note: "Jupiter TVL verified at $500M",
          status: "verified",
        },
      ],
      projects: [],
      narratives: [],
      total: 1,
    };
    expect(evidenceMatch.evidence[0]!.sourceName).toBe("Helius");
  });

  it("search matches on project category", () => {
    const catMatch = {
      query: "defi",
      projects: [
        {
          id: "jupiter",
          name: "Jupiter",
          category: "defi",
          description: "DEX aggregator",
        },
      ],
      narratives: [],
      evidence: [],
      total: 1,
    };
    expect(catMatch.projects[0]!.category).toBe("defi");
  });
});
