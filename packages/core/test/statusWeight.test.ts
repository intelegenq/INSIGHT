import { describe, expect, it } from "vitest";
import { STATUS_WEIGHT, statusWeight, evidenceWeight, confidenceFromEvidence } from "../src/index";
import type { Evidence } from "../src/types";

/**
 * Regression tests for the canonical evidence status weights.
 *
 * STATUS_WEIGHT is the single source of truth shared by core,
 * intelligence, and knowledge. These tests pin the values down so any
 * change is forced to be intentional.
 */

function makeEvidence(status: Evidence["status"], id = `ev-${status}`): Evidence {
  return {
    id,
    source: { id: "test-source", name: "Test source" },
    note: `note for ${status}`,
    status,
    observedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("STATUS_WEIGHT — canonical weight table", () => {
  it("has the expected four status entries", () => {
    expect(Object.keys(STATUS_WEIGHT).sort()).toEqual(["demo", "draft", "pending", "verified"]);
  });

  it("verified > pending > draft > demo", () => {
    expect(STATUS_WEIGHT.verified).toBeGreaterThan(STATUS_WEIGHT.pending);
    expect(STATUS_WEIGHT.pending).toBeGreaterThan(STATUS_WEIGHT.draft);
    expect(STATUS_WEIGHT.draft).toBeGreaterThan(STATUS_WEIGHT.demo);
  });

  it("golden values are pinned", () => {
    expect(STATUS_WEIGHT.verified).toBe(1);
    expect(STATUS_WEIGHT.pending).toBe(0.6);
    expect(STATUS_WEIGHT.draft).toBe(0.45);
    expect(STATUS_WEIGHT.demo).toBe(0.25);
  });

  it("statusWeight helper returns the same values as direct lookup", () => {
    expect(statusWeight("verified")).toBe(STATUS_WEIGHT.verified);
    expect(statusWeight("pending")).toBe(STATUS_WEIGHT.pending);
    expect(statusWeight("draft")).toBe(STATUS_WEIGHT.draft);
    expect(statusWeight("demo")).toBe(STATUS_WEIGHT.demo);
  });
});

describe("evidenceWeight — using canonical STATUS_WEIGHT", () => {
  it("sums weights across a list of evidence", () => {
    const evs: Evidence[] = [
      makeEvidence("verified", "a"),
      makeEvidence("verified", "b"),
      makeEvidence("pending", "c"),
    ];
    expect(evidenceWeight(evs)).toBeCloseTo(2.6, 10);
  });

  it("returns 0 for an empty list", () => {
    expect(evidenceWeight([])).toBe(0);
  });
});

describe("confidenceFromEvidence — driven by STATUS_WEIGHT", () => {
  it("returns illustrative for empty evidence", () => {
    expect(confidenceFromEvidence([])).toBe("illustrative");
  });

  it("returns high when 4+ verified evidence", () => {
    const evs = Array.from({ length: 4 }, (_, i) => makeEvidence("verified", `v${i}`));
    expect(confidenceFromEvidence(evs)).toBe("high");
  });

  it("returns medium when 2-3 verified", () => {
    const evs = Array.from({ length: 3 }, (_, i) => makeEvidence("verified", `v${i}`));
    expect(confidenceFromEvidence(evs)).toBe("medium");
  });

  it("returns draft when only demo evidence is present", () => {
    const evs = [makeEvidence("demo")];
    expect(confidenceFromEvidence(evs)).toBe("draft");
  });
});
