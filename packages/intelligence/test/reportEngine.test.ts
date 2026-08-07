import { describe, expect, it } from "vitest";
import type { Evidence, Narrative, Project } from "@insight/core";
import { DEFAULT_BOUNDS, scoreProjects } from "../src/engines/projectHealthEngine";
import { deriveNarratives } from "../src/engines/narrativeEngine";
import { generateReport } from "../src/engines/reportEngine";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";
const DEFAULTS = { referenceDate: REFERENCE_DATE, bounds: DEFAULT_BOUNDS };

function project(overrides: Partial<Project> & Pick<Project, "id" | "name">): Project {
  return {
    category: "defi",
    description: "",
    metrics: { tvl: 200_000_000, developerActivity: 30 },
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

function buildInput() {
  const evidenceById = new Map<string, Evidence>([
    ["e1", evidence("e1", "verified")],
    ["e2", evidence("e2", "verified")],
  ]);
  const projects = [
    project({ id: "p1", name: "Lending", category: "defi", evidenceIds: ["e1"] }),
    project({ id: "p2", name: "RPC", category: "infrastructure", evidenceIds: ["e2"] }),
  ];
  const scored = scoreProjects(projects, evidenceById, DEFAULTS);
  const narratives = deriveNarratives(projects, evidenceById, DEFAULTS);
  return { evidenceById, scored, narratives };
}

describe("ReportEngine", () => {
  it("generates a report through the requested lens", () => {
    const { evidenceById, scored, narratives } = buildInput();

    const report = generateReport({
      lens: "defi",
      projects: scored,
      narratives,
      evidenceById,
      defaults: DEFAULTS,
    });

    expect(report.lens).toBe("defi");
    expect(report.id).toBe("report-defi");
    expect(report.generatedAt).toBe(REFERENCE_DATE);
    expect(report.sections.thesis.length).toBeGreaterThan(0);
    expect(report.sections.catalyst).toBeDefined();
    expect(report.sections.risk).toBeDefined();
  });

  it("retains the evidence backing the report", () => {
    const { evidenceById, scored, narratives } = buildInput();

    const report = generateReport({
      lens: "ecosystem",
      projects: scored,
      narratives,
      evidenceById,
      defaults: DEFAULTS,
    });

    expect(report.evidenceIds).toContain("e1");
    expect(report.evidenceIds).toContain("e2");
  });

  it("marks reports as demo when all evidence is demo", () => {
    const demoEvidence = new Map<string, Evidence>([
      ["e1", evidence("e1", "demo")],
      ["e2", evidence("e2", "demo")],
    ]);
    const projects = [
      project({ id: "p1", name: "Lending", category: "defi", evidenceIds: ["e1"] }),
    ];
    const scored = scoreProjects(projects, demoEvidence, DEFAULTS);
    const narratives = deriveNarratives(projects, demoEvidence, DEFAULTS);

    const report = generateReport({
      lens: "defi",
      projects: scored,
      narratives,
      evidenceById: demoEvidence,
      defaults: DEFAULTS,
    });

    expect(report.isDemo).toBe(true);
    expect(report.confidence).toBe("draft");
  });

  it("is deterministic for identical inputs", () => {
    const { evidenceById, scored, narratives } = buildInput();
    const params = {
      lens: "infrastructure" as const,
      projects: scored,
      narratives: narratives as readonly { narrative: Narrative; momentum: number }[],
      evidenceById,
      defaults: DEFAULTS,
    };

    expect(generateReport(params)).toEqual(generateReport(params));
  });
});
