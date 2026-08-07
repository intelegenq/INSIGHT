import { describe, expect, it } from "vitest";
import {
  ReportGenerator,
  buildDeterministicGeneratedAt,
  buildDeterministicReportId,
  REPORT_EPOCH_MS,
} from "../../src/report";
import type { IntelligenceSignal } from "@insight/intelligence";

/**
 * Determinism regression tests for the report generator.
 *
 * These tests guard against any future regression to Date.now() or
 * Math.random() in the report ID or timestamp pipeline. Same inputs
 * must always produce byte-for-byte identical report IDs, generatedAt
 * timestamps, and rendered output.
 */

function makeSignal(id: string, overrides: Partial<IntelligenceSignal> = {}): IntelligenceSignal {
  return {
    id,
    type: "ecosystem-growth",
    title: `Signal ${id}`,
    description: `Description for ${id}`,
    confidence: 0.8,
    evidenceIds: [`ev-${id}`],
    supportingEvidence: [{ evidenceId: `ev-${id}`, relationship: "market-movement", weight: 0.7 }],
    timestamp: 1_700_000_000_000,
    metadata: { providerCount: 1, strength: "strong" },
    ...overrides,
  };
}

describe("Report ID — determinism", () => {
  it("produces the same id for the same content on repeated calls", () => {
    const signals = [makeSignal("a"), makeSignal("b")];
    const id1 = buildDeterministicReportId(signals, "Same Title");
    const id2 = buildDeterministicReportId(signals, "Same Title");
    expect(id1).toBe(id2);
  });

  it("ids are pure 8-hex-char content hashes (with optional suffix)", () => {
    const signals = [makeSignal("a")];
    const id = buildDeterministicReportId(signals, "T");
    expect(id).toMatch(/^report-[0-9a-f]{8}$/);
  });

  it("ids are stable across process restarts (golden file)", () => {
    const signals = [makeSignal("a"), makeSignal("b"), makeSignal("c")];
    const id = buildDeterministicReportId(signals, "Golden Title");
    // These specific values must not drift — they are the contract.
    expect(id).toBe("report-cb9cd1a6");
  });

  it("ids differ when content differs in any field", () => {
    const base = [makeSignal("a"), makeSignal("b")];
    const idBase = buildDeterministicReportId(base, "Title");

    expect(buildDeterministicReportId(base, "Other Title")).not.toBe(idBase);
    expect(buildDeterministicReportId([...base, makeSignal("c")], "Title")).not.toBe(idBase);
    expect(buildDeterministicReportId([makeSignal("a"), makeSignal("z")], "Title")).not.toBe(
      idBase,
    );
  });

  it("suffix allows same content to be reported multiple times with distinct ids", () => {
    const signals = [makeSignal("a")];
    const ids = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      ids.add(buildDeterministicReportId(signals, "T", `run-${i}`));
    }
    expect(ids.size).toBe(100);
  });
});

describe("Report timestamp — determinism", () => {
  it("produces the same timestamp for the same content on repeated calls", () => {
    const signals = [makeSignal("a"), makeSignal("b")];
    const t1 = buildDeterministicGeneratedAt(signals, "Title");
    const t2 = buildDeterministicGeneratedAt(signals, "Title");
    expect(t1).toBe(t2);
  });

  it("timestamp is bounded within a fixed window of the Insight epoch", () => {
    const signals = Array.from({ length: 25 }, (_, i) => makeSignal(`s${i}`));
    const t = buildDeterministicGeneratedAt(signals, "Big Report");
    expect(t).toBeGreaterThanOrEqual(REPORT_EPOCH_MS);
    expect(t).toBeLessThan(REPORT_EPOCH_MS + 1_000_000);
  });
});

describe("ReportGenerator — determinism", () => {
  it("ReportGenerator produces byte-identical reports for identical inputs", () => {
    const gen1 = new ReportGenerator({ title: "Deterministic Title", format: "markdown" });
    const gen2 = new ReportGenerator({ title: "Deterministic Title", format: "markdown" });
    const signals = [makeSignal("a"), makeSignal("b"), makeSignal("c")];
    const r1 = gen1.generateReport(signals);
    const r2 = gen2.generateReport(signals);
    expect(r1.id).toBe(r2.id);
    expect(r1.generatedAt).toBe(r2.generatedAt);
    expect(r1.metadata).toEqual(r2.metadata);
    expect(r1.summary).toBe(r2.summary);
  });

  it("rendered markdown is byte-identical across two independent runs", () => {
    const gen = new ReportGenerator({ title: "Render Test", format: "markdown" });
    const signals = [makeSignal("x"), makeSignal("y")];
    const a = gen.generateAndRender(signals, "markdown");
    const b = gen.generateAndRender(signals, "markdown");
    expect(a).toBe(b);
  });

  it("rendered html is byte-identical across two independent runs", () => {
    const gen = new ReportGenerator({ title: "Render Test", format: "html" });
    const signals = [makeSignal("x")];
    const a = gen.generateAndRender(signals, "html");
    const b = gen.generateAndRender(signals, "html");
    expect(a).toBe(b);
  });

  it("rendered json is byte-identical across two independent runs", () => {
    const gen = new ReportGenerator({ title: "Render Test", format: "json" });
    const signals = [makeSignal("x")];
    const a = gen.generateAndRender(signals, "json");
    const b = gen.generateAndRender(signals, "json");
    expect(a).toBe(b);
  });

  it("id never contains a wall-clock component", () => {
    const gen = new ReportGenerator({ title: "Wallclock Test" });
    const signals = [makeSignal("a")];
    const r = gen.generateReport(signals);
    // No 13-digit millisecond timestamp embedded in the id
    expect(r.id).not.toMatch(/_\d{13}_/);
    // And id is 8 hex chars (with optional suffix) — no date-time either
    expect(r.id).not.toMatch(/_\d{4}-\d{2}-\d{2}/);
  });
});
