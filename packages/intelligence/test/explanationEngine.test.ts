import { describe, expect, it } from "vitest";
import type { Evidence, Project, Narrative, Report, ReportLens } from "@insight/core";
import type { ScoredProject, DerivedNarrative, ProjectHealth } from "../src/types";
import {
  explainProjectHealth,
  explainNarrative,
  explainSignal,
  explainReport,
  formatProjectHealthExplanation,
  formatNarrativeExplanation,
  formatSignalExplanation,
  formatReportExplanation,
} from "../src/engines/explanationEngine";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";

function makeProject(overrides: Partial<Project> & Pick<Project, "id" | "name">): Project {
  return {
    category: "defi",
    description: "Test protocol",
    metrics: { tvl: 200_000_000, volume24h: 50_000_000, activeUsers24h: 1000, developerActivity: 30 },
    evidenceIds: ["e1"],
    updatedAt: REFERENCE_DATE,
    ...overrides,
  };
}

function makeEvidence(id: string, status: Evidence["status"] = "verified"): Evidence {
  return {
    id,
    source: { id: `src-${id}`, name: `Source ${id}` },
    note: `Evidence ${id}`,
    status,
    observedAt: "2026-08-06T00:00:00.000Z",
  };
}

function makeHealth(overrides: Partial<ProjectHealth> = {}): ProjectHealth {
  return {
    health: 75,
    momentum: 30,
    risk: 20,
    developer: 60,
    ...overrides,
  };
}

function makeNarrative(overrides: Partial<Narrative> = {}): Narrative {
  return {
    id: "narrative-defi",
    name: "DeFi",
    trend: "up",
    change: "+25%",
    note: "DeFi narrative across 2 projects, supported by 4 evidence signals with positive momentum.",
    projectIds: ["p1", "p2"],
    evidenceIds: ["e1", "e2", "e3", "e4"],
    ...overrides,
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "report-defi",
    lens: "defi",
    title: "DeFi · DeFi brief",
    sections: {
      thesis: "DeFi narrative shows strong adoption. The leading signal here carries +25%.",
      catalyst: "Watch Lending: its health score is 80/100 and its risk is 15/100.",
      risk: "Risk reflects evidence trust and coverage; confidence is currently medium, so treat conclusions as provisional.",
    },
    evidenceIds: ["e1", "e2"],
    confidence: "medium",
    generatedAt: REFERENCE_DATE,
    isDemo: false,
    ...overrides,
  };
}

function makeScoredProject(project: Project, health: ProjectHealth, evidence: Evidence[]): ScoredProject {
  return { project, health, evidence };
}

function makeDerivedNarrative(narrative: Narrative, momentum: number): DerivedNarrative {
  return { narrative, momentum };
}

describe("ExplanationEngine", () => {
  describe("explainProjectHealth", () => {
    it("generates explanations for a healthy project with verified evidence", () => {
      const project = makeProject({ id: "p1", name: "Lending" });
      const health = makeHealth({ health: 80, momentum: 30, risk: 15, developer: 70 });
      const evidence = [makeEvidence("e1", "verified"), makeEvidence("e2", "verified")];

      const reasons = explainProjectHealth(project, health, evidence);

      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons.some(r => r.includes("Moderate TVL ($200.0M)") || r.includes("Strong TVL ($200.0M)") || r.includes("Strong TVL") || r.includes("Moderate TVL"))).toBe(true);
      expect(reasons.some(r => r.includes("verified evidence"))).toBe(true);
      expect(reasons.some(r => r.includes("Low risk") || r.includes("Moderate risk"))).toBe(true);
      expect(reasons.some(r => r.includes("Positive momentum") || r.includes("momentum"))).toBe(true);
    });

    it("generates explanations for a project with demo evidence", () => {
      const project = makeProject({ id: "p1", name: "NewProtocol" });
      const health = makeHealth({ health: 45, momentum: -10, risk: 55, developer: 20 });
      const evidence = [makeEvidence("e1", "demo")];

      const reasons = explainProjectHealth(project, health, evidence);

      expect(reasons.some(r => r.includes("demo evidence"))).toBe(true);
      expect(reasons.some(r => r.includes("Elevated risk") || r.includes("Moderate risk"))).toBe(true);
    });

    it("handles missing TVL gracefully", () => {
      const project = makeProject({ id: "p1", name: "NoTVL", metrics: { developerActivity: 10 } });
      const health = makeHealth({ health: 30, momentum: 0, risk: 40, developer: 20 });
      const evidence = [makeEvidence("e1", "verified")];

      const reasons = explainProjectHealth(project, health, evidence);

      expect(reasons.some(r => r.includes("No TVL data"))).toBe(true);
    });
  });

  describe("explainNarrative", () => {
    it("generates explanations for a narrative with projects and evidence", () => {
      const narrative = makeNarrative();
      const projects = [makeProject({ id: "p1", name: "Lending" }), makeProject({ id: "p2", name: "DEX" })];
      const evidence = [makeEvidence("e1"), makeEvidence("e2"), makeEvidence("e3"), makeEvidence("e4")];

      const reasons = explainNarrative(narrative, projects, evidence);

      expect(reasons.some(r => r.includes("DeFi narrative identified"))).toBe(true);
      expect(reasons.some(r => r.includes("Lending, DEX"))).toBe(true);
      expect(reasons.some(r => r.includes("4 evidence item(s)"))).toBe(true);
    });

    it("handles narrative with no projects", () => {
      const narrative = makeNarrative({ projectIds: [], evidenceIds: [] });
      const projects: Project[] = [];
      const evidence: Evidence[] = [];

      const reasons = explainNarrative(narrative, projects, evidence);

      expect(reasons.some(r => r.includes("0 project(s)"))).toBe(true);
    });
  });

  describe("explainSignal", () => {
    it("generates explanations for a signal with supporting evidence", () => {
      const signal = {
        id: "signal-1",
        type: "ecosystem-growth",
        title: "Ecosystem Growth Signal",
        confidence: 0.85,
        evidenceIds: ["e1", "e2"],
        supportingEvidence: [
          { evidenceId: "e1", relationship: "supports", weight: 0.5 },
          { evidenceId: "e2", relationship: "correlates", weight: 0.5 },
        ],
      };
      const evidenceById = new Map([
        ["e1", makeEvidence("e1", "verified")],
        ["e2", makeEvidence("e2", "verified")],
      ]);

      const reasons = explainSignal(signal, evidenceById);

      expect(reasons.some(r => r.includes("85%") || r.includes("confidence: 85%"))).toBe(true);
      expect(reasons.some(r => r.includes("High confidence"))).toBe(true);
      expect(reasons.some(r => r.includes("supports"))).toBe(true);
    });

    it("handles low confidence signals", () => {
      const signal = {
        id: "signal-2",
        type: "unknown",
        title: "Weak Signal",
        confidence: 0.25,
        evidenceIds: ["e1"],
        supportingEvidence: [{ evidenceId: "e1", relationship: "correlates", weight: 1 }],
      };
      const evidenceById = new Map([["e1", makeEvidence("e1", "demo")]]);

      const reasons = explainSignal(signal, evidenceById);

      expect(reasons.some(r => r.includes("Low confidence"))).toBe(true);
    });
  });

  describe("explainReport", () => {
    it("generates explanations for a report with traceability", () => {
      const report = makeReport();
      const projects = [
        makeScoredProject(makeProject({ id: "p1", name: "Lending" }), makeHealth({ health: 80 }), [makeEvidence("e1")]),
        makeScoredProject(makeProject({ id: "p2", name: "DEX" }), makeHealth({ health: 70 }), [makeEvidence("e2")]),
      ];
      const narratives = [makeDerivedNarrative(makeNarrative(), 25)];
      const evidenceById = new Map([
        ["e1", makeEvidence("e1", "verified")],
        ["e2", makeEvidence("e2", "verified")],
      ]);
      const lens: ReportLens = "defi";

      const reasons = explainReport(report, projects, narratives, evidenceById, lens);

      expect(reasons.some(r => r.includes('"defi" lens') || r.includes("defi lens"))).toBe(true);
      expect(reasons.some(r => r.includes("DeFi · DeFi brief"))).toBe(true);
      expect(reasons.some(r => r.includes("Driven by DeFi narrative"))).toBe(true);
      expect(reasons.some(r => r.includes("Lending"))).toBe(true);
      expect(reasons.some(r => r.includes("evidence reference(s)"))).toBe(true);
    });

    it("marks demo reports", () => {
      const report = makeReport({ isDemo: true });
      const projects: ScoredProject[] = [];
      const narratives: DerivedNarrative[] = [];
      const evidenceById = new Map();
      const lens: ReportLens = "ecosystem";

      const reasons = explainReport(report, projects, narratives, evidenceById, lens);

      expect(reasons.some(r => r.includes("demo/synthetic data"))).toBe(true);
    });
  });

  describe("format*Explanation", () => {
    it("formats project health explanation with summary and traceability", () => {
      const project = makeProject({ id: "p1", name: "TestProject" });
      const health = makeHealth({ health: 75, momentum: 20, risk: 25, developer: 50 });
      const evidence = [makeEvidence("e1", "verified")];

      const result = formatProjectHealthExplanation(project, health, evidence);

      expect(result.summary).toContain("TestProject health: 75/100");
      expect(result.summary).toContain("momentum: 20%");
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.traceability.evidenceIds).toEqual(["e1"]);
      expect(result.traceability.projectIds).toEqual(["p1"]);
    });

    it("formats narrative explanation", () => {
      const narrative = makeNarrative({ name: "Test Narrative", trend: "up", change: "+15%" });
      const projects = [makeProject({ id: "p1", name: "P1" }), makeProject({ id: "p2", name: "P2" })];
      const evidence = [makeEvidence("e1"), makeEvidence("e2")];

      const result = formatNarrativeExplanation(narrative, projects, evidence);

      expect(result.summary).toContain("Test Narrative narrative (up +15%)");
      expect(result.traceability.projectIds).toEqual(["p1", "p2"]);
      expect(result.traceability.narrativeIds).toEqual(["narrative-defi"]);
    });

    it("formats signal explanation", () => {
      const signal = {
        id: "signal-1",
        type: "protocol-momentum",
        title: "Protocol Momentum",
        confidence: 0.72,
        evidenceIds: ["e1"],
        supportingEvidence: [{ evidenceId: "e1", relationship: "supports", weight: 1 }],
      };
      const evidenceById = new Map([["e1", makeEvidence("e1", "verified")]]);

      const result = formatSignalExplanation(signal, evidenceById);

      expect(result.summary).toContain("Protocol Momentum — 72% confidence");
      expect(result.traceability.evidenceIds).toEqual(["e1"]);
    });

    it("formats report explanation", () => {
      const report = makeReport();
      const projects = [
        makeScoredProject(makeProject({ id: "p1", name: "Lending" }), makeHealth({ health: 80 }), [makeEvidence("e1")]),
      ];
      const narratives = [makeDerivedNarrative(makeNarrative(), 25)];
      const evidenceById = new Map([["e1", makeEvidence("e1", "verified")], ["e2", makeEvidence("e2", "verified")]]);
      const lens: ReportLens = "defi";

      const result = formatReportExplanation(report, projects, narratives, evidenceById, lens);

      expect(result.summary).toContain("defi lens");
      expect(result.summary).toContain("medium confidence");
      expect(result.traceability.projectIds).toEqual(["p1"]);
      expect(result.traceability.narrativeIds).toEqual(["narrative-defi"]);
    });
  });
});