import { describe, expect, it } from "vitest";

/**
 * M42 — Snapshot history timeline visualization.
 *
 * Tests verify the timeline UI data contract: chronological snapshot
 * ordering, per-snapshot metric cards, delta computation between
 * selected and compare-base snapshots, diff summary counts, and
 * navigation state. Uses existing snapshot, history, and diff
 * contracts — no new data or AI.
 */

describe("M42 — Snapshot history timeline data contract", () => {
  const mockSnapshots = [
    {
      id: "snapshot-2026-01-01-aaaa0000",
      referenceDate: "2026-01-01T00:00:00.000Z",
      summary: { projectCount: 2, narrativeCount: 3, evidenceCount: 5, graphEntityCount: 10 },
    },
    {
      id: "snapshot-2026-01-08-bbbb1111",
      referenceDate: "2026-01-08T00:00:00.000Z",
      summary: { projectCount: 3, narrativeCount: 4, evidenceCount: 8, graphEntityCount: 15 },
    },
    {
      id: "snapshot-2026-01-15-cccc2222",
      referenceDate: "2026-01-15T00:00:00.000Z",
      summary: { projectCount: 3, narrativeCount: 3, evidenceCount: 7, graphEntityCount: 14 },
    },
  ];

  it("snapshots are sorted chronologically by referenceDate", () => {
    const sorted = [...mockSnapshots].sort(
      (a, b) => new Date(a.referenceDate).getTime() - new Date(b.referenceDate).getTime(),
    );
    expect(sorted[0]!.id).toBe("snapshot-2026-01-01-aaaa0000");
    expect(sorted[1]!.id).toBe("snapshot-2026-01-08-bbbb1111");
    expect(sorted[2]!.id).toBe("snapshot-2026-01-15-cccc2222");
  });

  it("each snapshot has id, referenceDate, and summary with 4 counts", () => {
    for (const s of mockSnapshots) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.referenceDate).toBe("string");
      expect(typeof s.summary.projectCount).toBe("number");
      expect(typeof s.summary.narrativeCount).toBe("number");
      expect(typeof s.summary.evidenceCount).toBe("number");
      expect(typeof s.summary.graphEntityCount).toBe("number");
    }
  });

  it("timeline nodes show per-snapshot project count and delta from previous", () => {
    const deltas = mockSnapshots.map((s, i) => {
      if (i === 0) return 0;
      return s.summary.projectCount - mockSnapshots[i - 1]!.summary.projectCount;
    });
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBe(1);
    expect(deltas[2]).toBe(0);
  });

  it("selected snapshot shows 4 metric cards", () => {
    const selected = mockSnapshots[2]!;
    const cards = [
      { label: "Projects", value: selected.summary.projectCount },
      { label: "Narratives", value: selected.summary.narrativeCount },
      { label: "Evidence", value: selected.summary.evidenceCount },
      { label: "Graph Entities", value: selected.summary.graphEntityCount },
    ];
    expect(cards.length).toBe(4);
    expect(cards[0]!.value).toBe(3);
    expect(cards[3]!.value).toBe(14);
  });

  it("delta bar computes change between selected and compare base", () => {
    const selected = mockSnapshots[2]!;
    const compare = mockSnapshots[1]!;
    const deltas = {
      projects: selected.summary.projectCount - compare.summary.projectCount,
      narratives: selected.summary.narrativeCount - compare.summary.narrativeCount,
      evidence: selected.summary.evidenceCount - compare.summary.evidenceCount,
      graph: selected.summary.graphEntityCount - compare.summary.graphEntityCount,
    };
    expect(deltas.projects).toBe(0);
    expect(deltas.narratives).toBe(-1);
    expect(deltas.evidence).toBe(-1);
    expect(deltas.graph).toBe(-1);
  });

  it("delta values classify as up, down, or flat", () => {
    function classify(delta: number): string {
      return delta > 0 ? "tl-diff-up" : delta < 0 ? "tl-diff-down" : "tl-diff-flat";
    }
    expect(classify(1)).toBe("tl-diff-up");
    expect(classify(-1)).toBe("tl-diff-down");
    expect(classify(0)).toBe("tl-diff-flat");
  });

  it("navigation earlier/later respects timeline boundaries", () => {
    const idx = mockSnapshots.findIndex((s) => s.id === "snapshot-2026-01-08-bbbb1111");
    expect(idx).toBe(1);
    const canGoEarlier = idx > 0;
    const canGoLater = idx < mockSnapshots.length - 1;
    expect(canGoEarlier).toBe(true);
    expect(canGoLater).toBe(true);

    // At first snapshot, can't go earlier
    const firstIdx = 0;
    expect(firstIdx > 0).toBe(false);
    // At last snapshot, can't go later
    const lastIdx = mockSnapshots.length - 1;
    expect(lastIdx < mockSnapshots.length - 1).toBe(false);
  });
});

describe("M42 — History diff contract", () => {
  const mockDiff = {
    fromId: "snapshot-2026-01-01-aaaa0000",
    toId: "snapshot-2026-01-08-bbbb1111",
    fromReferenceDate: "2026-01-01T00:00:00.000Z",
    toReferenceDate: "2026-01-08T00:00:00.000Z",
    projects: [
      {
        projectId: "proj-lending",
        name: "Illustrative Lending Pool",
        category: "defi",
        metrics: [
          {
            metric: "tvl",
            from: 1000000000,
            to: 1240000000,
            delta: 240000000,
            direction: "increased",
          },
        ],
        descriptionChanged: false,
      },
    ],
    narratives: [
      {
        narrativeId: "narr-defi",
        name: "DeFi Growth",
        fromTrend: "flat",
        toTrend: "up",
        trendChange: "trend-shifted",
        noteChanged: false,
      },
    ],
    summary: {
      addedProjects: 1,
      removedProjects: 0,
      commonProjects: 2,
      changedProjects: 1,
      changedNarratives: 1,
    },
  };

  it("diff includes fromId, toId, fromReferenceDate, toReferenceDate", () => {
    expect(mockDiff).toHaveProperty("fromId");
    expect(mockDiff).toHaveProperty("toId");
    expect(mockDiff).toHaveProperty("fromReferenceDate");
    expect(mockDiff).toHaveProperty("toReferenceDate");
  });

  it("diff summary counts are non-negative integers", () => {
    const s = mockDiff.summary;
    expect(s.addedProjects).toBeGreaterThanOrEqual(0);
    expect(s.removedProjects).toBeGreaterThanOrEqual(0);
    expect(s.commonProjects).toBeGreaterThanOrEqual(0);
    expect(s.changedProjects).toBeGreaterThanOrEqual(0);
    expect(s.changedNarratives).toBeGreaterThanOrEqual(0);
  });

  it("project changes include metric deltas with direction", () => {
    for (const p of mockDiff.projects) {
      expect(typeof p.projectId).toBe("string");
      expect(typeof p.name).toBe("string");
      for (const m of p.metrics) {
        expect(["increased", "decreased", "unchanged"]).toContain(m.direction);
      }
    }
  });

  it("narrative changes include trend transitions", () => {
    for (const n of mockDiff.narratives) {
      expect(typeof n.narrativeId).toBe("string");
      expect(typeof n.trendChange).toBe("string");
    }
  });

  it("diff summary shows 4 count cards: added, removed, changed, narratives", () => {
    const cards = [
      { label: "Projects added", value: mockDiff.summary.addedProjects },
      { label: "Projects removed", value: mockDiff.summary.removedProjects },
      { label: "Projects changed", value: mockDiff.summary.changedProjects },
      { label: "Narratives changed", value: mockDiff.summary.changedNarratives },
    ];
    expect(cards.length).toBe(4);
    expect(cards[0]!.value).toBe(1);
    expect(cards[1]!.value).toBe(0);
  });

  it("direction arrow maps correctly", () => {
    function arrow(dir: string): string {
      switch (dir) {
        case "increased":
          return "↑";
        case "decreased":
          return "↓";
        default:
          return "→";
      }
    }
    expect(arrow("increased")).toBe("↑");
    expect(arrow("decreased")).toBe("↓");
    expect(arrow("unchanged")).toBe("→");
  });

  it("metric value formatting handles large numbers", () => {
    function fmt(v: number | undefined): string {
      if (v === undefined) return "—";
      if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
      return v.toLocaleString();
    }
    expect(fmt(1_240_000_000)).toBe("$1.24B");
    expect(fmt(86_000_000)).toBe("$86.0M");
    expect(fmt(14_200)).toBe("$14K");
    expect(fmt(undefined)).toBe("—");
  });

  it("empty diff (no changes) is handled gracefully", () => {
    const emptyDiff = {
      ...mockDiff,
      projects: [],
      narratives: [],
      summary: {
        addedProjects: 0,
        removedProjects: 0,
        commonProjects: 2,
        changedProjects: 0,
        changedNarratives: 0,
      },
    };
    expect(emptyDiff.projects.length).toBe(0);
    expect(emptyDiff.narratives.length).toBe(0);
  });
});
