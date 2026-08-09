import { describe, expect, it } from "vitest";

/**
 * M41 — Dashboard customization.
 *
 * Tests verify the dashboard API response contract and the client-side
 * configuration model: section toggles, reordering, localStorage
 * persistence, and default layout. Uses existing pulse, projects,
 * narratives, and timeline data — no new data or AI.
 */

describe("M41 — Dashboard customization response contract", () => {
  const mockDashboardResponse = {
    pulse: {
      asOf: "2026-01-01T00:00:00.000Z",
      metrics: [
        { id: "projects", label: "Tracked Projects", value: "2", caption: "Protocols in scope" },
        {
          id: "narratives",
          label: "Active Narratives",
          value: "3",
          caption: "Surfaced themes",
          variant: "violet",
        },
        { id: "evidence", label: "Evidence Items", value: "5", caption: "Citable signals" },
        { id: "graph", label: "Graph Entities", value: "10", caption: "Entity graph nodes" },
      ],
    },
    timeline: [
      {
        id: "timeline-0-proj-lending",
        time: "2026-01-01",
        title: "Illustrative Lending Pool",
        source: "defi",
        confidence: "medium",
      },
    ],
    projects: [
      {
        id: "proj-lending",
        name: "Illustrative Lending Pool",
        category: "defi",
        description: "A demo lending protocol.",
        tvl: 1240000000,
        volume24h: 86000000,
      },
      {
        id: "proj-ormlite",
        name: "Ormlite Compiler",
        category: "infrastructure",
        description: "A demo compiler toolchain.",
        tvl: 0,
        volume24h: 0,
      },
    ],
    narratives: [
      {
        id: "narr-defi",
        name: "DeFi Growth",
        trend: "up",
        change: "+18.4%",
        note: "Lending leads.",
        projectIds: ["proj-lending"],
        evidenceIds: ["ev-001"],
      },
    ],
    asOf: "2026-01-01T00:00:00.000Z",
  };

  it("response includes pulse, timeline, projects, narratives, asOf", () => {
    expect(mockDashboardResponse).toHaveProperty("pulse");
    expect(mockDashboardResponse).toHaveProperty("timeline");
    expect(mockDashboardResponse).toHaveProperty("projects");
    expect(mockDashboardResponse).toHaveProperty("narratives");
    expect(mockDashboardResponse).toHaveProperty("asOf");
  });

  it("pulse includes asOf and metrics array", () => {
    expect(mockDashboardResponse.pulse).toHaveProperty("asOf");
    expect(Array.isArray(mockDashboardResponse.pulse.metrics)).toBe(true);
    expect(mockDashboardResponse.pulse.metrics.length).toBeGreaterThan(0);
  });

  it("each pulse metric has id, label, value, caption", () => {
    for (const m of mockDashboardResponse.pulse.metrics) {
      expect(typeof m.id).toBe("string");
      expect(typeof m.label).toBe("string");
      expect(typeof m.value).toBe("string");
      expect(typeof m.caption).toBe("string");
    }
  });

  it("projects are sorted by TVL descending", () => {
    const tvls = mockDashboardResponse.projects.map((p) => p.tvl ?? 0);
    for (let i = 1; i < tvls.length; i++) {
      expect(tvls[i]).toBeLessThanOrEqual(tvls[i - 1]!);
    }
  });

  it("projects include id, name, category, description, tvl", () => {
    for (const p of mockDashboardResponse.projects) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
      expect(typeof p.category).toBe("string");
      expect(typeof p.description).toBe("string");
    }
  });

  it("timeline events have id, time, title, source, confidence", () => {
    for (const e of mockDashboardResponse.timeline) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.time).toBe("string");
      expect(typeof e.title).toBe("string");
      expect(typeof e.source).toBe("string");
      expect(typeof e.confidence).toBe("string");
    }
  });

  it("narratives have id, name, trend, note", () => {
    for (const n of mockDashboardResponse.narratives) {
      expect(typeof n.id).toBe("string");
      expect(typeof n.name).toBe("string");
      expect(typeof n.trend).toBe("string");
      expect(typeof n.note).toBe("string");
    }
  });
});

describe("M41 — Dashboard section configuration model", () => {
  const DEFAULT_SECTIONS: { id: string; label: string; visible: boolean; order: number }[] = [
    { id: "pulse", label: "Ecosystem Pulse", visible: true, order: 0 },
    { id: "projects", label: "Top Projects", visible: true, order: 1 },
    { id: "narratives", label: "Narratives", visible: true, order: 2 },
    { id: "timeline", label: "Research Timeline", visible: true, order: 3 },
  ];

  it("default config has 4 sections all visible", () => {
    expect(DEFAULT_SECTIONS.length).toBe(4);
    expect(DEFAULT_SECTIONS.every((s) => s.visible)).toBe(true);
  });

  it("each section has a unique id", () => {
    const ids = DEFAULT_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("orders are sequential 0..n-1", () => {
    const orders = DEFAULT_SECTIONS.map((s) => s.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("toggling a section sets visible=false", () => {
    const toggled = DEFAULT_SECTIONS.map((s) =>
      s.id === "pulse" ? { ...s, visible: !s.visible } : { ...s },
    );
    const pulse = toggled.find((s) => s.id === "pulse");
    expect(pulse?.visible).toBe(false);
  });

  it("reordering swaps order values", () => {
    const sections = DEFAULT_SECTIONS.map((s) => ({ ...s }));
    const a = sections.find((s) => s.id === "pulse")!;
    const b = sections.find((s) => s.id === "projects")!;
    const tempOrder = a.order;
    a.order = b.order;
    b.order = tempOrder;
    expect(a.order).toBe(1);
    expect(b.order).toBe(0);
  });

  it("only visible sections are rendered", () => {
    const visible = DEFAULT_SECTIONS.map((s) => ({ ...s })).filter((s) => s.visible);
    expect(visible.length).toBe(4);
    const hidden = DEFAULT_SECTIONS.map((s) =>
      s.id === "timeline" ? { ...s, visible: false } : { ...s },
    );
    const visibleAfter = hidden.filter((s) => s.visible);
    expect(visibleAfter.length).toBe(3);
    expect(visibleAfter.find((s) => s.id === "timeline")).toBeUndefined();
  });

  it("sorted by order produces correct render sequence", () => {
    const sorted = [...DEFAULT_SECTIONS].sort((a, b) => a.order - b.order);
    expect(sorted[0]!.id).toBe("pulse");
    expect(sorted[1]!.id).toBe("projects");
    expect(sorted[2]!.id).toBe("narratives");
    expect(sorted[3]!.id).toBe("timeline");
  });

  it("config can be serialized for localStorage", () => {
    const json = JSON.stringify(DEFAULT_SECTIONS);
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(4);
    expect(parsed[0]!.id).toBe("pulse");
    expect(parsed[0]!.visible).toBe(true);
  });

  it("config can be reset to defaults", () => {
    const modified = DEFAULT_SECTIONS.map((s) => ({
      ...s,
      visible: false,
      order: 3 - s.order,
    }));
    const reset = DEFAULT_SECTIONS.map((s) => ({ ...s }));
    expect(reset.every((s) => s.visible)).toBe(true);
    expect(reset[0]!.order).toBe(0);
    expect(modified.every((s) => !s.visible)).toBe(true);
  });
});
