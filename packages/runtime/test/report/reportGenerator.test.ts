import { describe, expect, it } from "vitest";
import {
  ReportGenerator,
  MarkdownRenderer,
  HtmlRenderer,
  JsonRenderer,
  calculateReportMetadata,
  generateSummary,
  generateReportId,
} from "../../src/report/index.ts";
import type { IntelligenceSignal, SignalEvidence } from "@insight/intelligence";

function createMockSignal(overrides: Partial<IntelligenceSignal> = {}): IntelligenceSignal {
  const defaultSignal: IntelligenceSignal = {
    id: "signal_1",
    type: "ecosystem-growth",
    title: "Solana ecosystem activity increased",
    description: "Multiple independent sources show increased activity",
    confidence: 0.82,
    evidenceIds: ["ev_1", "ev_2"],
    supportingEvidence: [
      { evidenceId: "ev_1", relationship: "market-movement", weight: 0.8 },
      { evidenceId: "ev_2", relationship: "protocol-tvl", weight: 0.7 },
    ],
    timestamp: Date.now(),
    metadata: { providerCount: 2, strength: "strong" },
  };
  return { ...defaultSignal, ...overrides };
}

function createMockSignals(count: number): IntelligenceSignal[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSignal({
      id: `signal_${i + 1}`,
      type: i % 2 === 0 ? "ecosystem-growth" : "protocol-momentum",
      title: `Signal ${i + 1}`,
      confidence: 0.5 + (i % 5) * 0.1,
    }),
  );
}

describe("ReportTypes — helpers", () => {
  it("generateReportId produces unique IDs", () => {
    const id1 = generateReportId();
    const id2 = generateReportId();
    expect(id1).toMatch(/^report_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^report_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it("calculateReportMetadata computes correct values", () => {
    const signals = createMockSignals(3);
    const meta = calculateReportMetadata(signals);
    expect(meta.signalCount).toBe(3);
    expect(meta.signalTypes).toContain("ecosystem-growth");
    expect(meta.signalTypes).toContain("protocol-momentum");
    expect(meta.avgConfidence).toBeGreaterThan(0);
    expect(meta.generatorVersion).toBe("1.0.0");
  });

  it("calculateReportMetadata handles empty signals", () => {
    const meta = calculateReportMetadata([]);
    expect(meta.signalCount).toBe(0);
    expect(meta.signalTypes).toEqual([]);
    expect(meta.avgConfidence).toBe(0);
  });

  it("generateSummary creates meaningful summary", () => {
    const signals = createMockSignals(4);
    const summary = generateSummary(signals);
    expect(summary).toContain("4 signal");
    expect(summary).toContain("ecosystem-growth");
    expect(summary).toContain("protocol-momentum");
    expect(summary).toContain("evidence reference");
  });

  it("generateSummary handles empty signals", () => {
    const summary = generateSummary([]);
    expect(summary).toContain("No intelligence signals");
  });
});

describe("MarkdownRenderer", () => {
  const renderer = new MarkdownRenderer();
  const config = { includeMetadata: true, includeSummary: true, includeSignalDetails: true };

  it("renders empty signals", () => {
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test Report",
      signals: [] as IntelligenceSignal[],
      summary: "No signals",
      metadata: { signalCount: 0, signalTypes: [], avgConfidence: 0, generatorVersion: "1.0.0" },
    };
    const output = renderer.render(report, config);
    expect(output).toContain("# Test Report");
    expect(output).toContain("No signals generated");
  });

  it("renders signals with all sections", () => {
    const signals = createMockSignals(2);
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test Report",
      signals,
      summary: "Summary text",
      metadata: {
        signalCount: 2,
        signalTypes: ["ecosystem-growth"],
        avgConfidence: 0.8,
        generatorVersion: "1.0.0",
      },
    };
    const output = renderer.render(report, config);
    expect(output).toContain("# Test Report");
    expect(output).toContain("## Metadata");
    expect(output).toContain("## Summary");
    expect(output).toContain("## Signals");
    expect(output).toContain("Signal 1");
    expect(output).toContain("Signal 2");
    expect(output).toContain("ecosystem-growth");
    expect(output).toContain("protocol-momentum");
    expect(output).toContain("Confidence");
    expect(output).toContain("Evidence Refs");
  });

  it("respects config flags", () => {
    const signals = createMockSignals(1);
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test",
      signals,
      summary: "Summary",
      metadata: {
        signalCount: 1,
        signalTypes: ["ecosystem-growth"],
        avgConfidence: 0.8,
        generatorVersion: "1.0.0",
      },
    };

    const noMeta = renderer.render(report, { ...config, includeMetadata: false });
    expect(noMeta).not.toContain("## Metadata");

    const noSummary = renderer.render(report, { ...config, includeSummary: false });
    expect(noSummary).not.toContain("## Summary");

    const noDetails = renderer.render(report, { ...config, includeSignalDetails: false });
    expect(noDetails).not.toContain("## Signals");
  });
});

describe("HtmlRenderer", () => {
  const renderer = new HtmlRenderer();
  const config = { includeMetadata: true, includeSummary: true, includeSignalDetails: true };

  it("renders valid HTML structure", () => {
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test Report",
      signals: [] as IntelligenceSignal[],
      summary: "No signals",
      metadata: { signalCount: 0, signalTypes: [], avgConfidence: 0, generatorVersion: "1.0.0" },
    };
    const output = renderer.render(report, config);
    expect(output).toContain("<!DOCTYPE html>");
    expect(output).toContain("<html");
    expect(output).toContain("<head>");
    expect(output).toContain("<body>");
    expect(output).toContain("</html>");
    expect(output).toContain("Test Report");
  });

  it("includes inline styles", () => {
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test",
      signals: [] as IntelligenceSignal[],
      summary: "Summary",
      metadata: { signalCount: 0, signalTypes: [], avgConfidence: 0, generatorVersion: "1.0.0" },
    };
    const output = renderer.render(report, config);
    expect(output).toContain("<style>");
    expect(output).toContain(".container");
    expect(output).toContain(".signal-card");
  });

  it("renders signals with proper structure", () => {
    const signals = createMockSignals(2);
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test",
      signals,
      summary: "Summary",
      metadata: {
        signalCount: 2,
        signalTypes: ["ecosystem-growth"],
        avgConfidence: 0.8,
        generatorVersion: "1.0.0",
      },
    };
    const output = renderer.render(report, config);
    expect(output).toContain("Signal 1");
    expect(output).toContain("Signal 2");
    expect(output).toContain("ecosystem-growth");
    expect(output).toContain("protocol-momentum");
    expect(output).toContain("Confidence:");
    expect(output).toContain("Evidence Refs:");
  });

  it("escapes HTML in content", () => {
    const signals = [
      createMockSignal({ title: "<script>alert(1)</script>", description: "x < y" }),
    ];
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test",
      signals,
      summary: "Summary",
      metadata: {
        signalCount: 1,
        signalTypes: ["ecosystem-growth"],
        avgConfidence: 0.8,
        generatorVersion: "1.0.0",
      },
    };
    const output = renderer.render(report, config);
    expect(output).not.toContain("<script>");
    expect(output).toContain("&#60;script&#62;");
    expect(output).toContain("x &#60; y");
  });
});

describe("JsonRenderer", () => {
  const renderer = new JsonRenderer();
  const config = { includeMetadata: true, includeSummary: true, includeSignalDetails: true };

  it("outputs valid JSON", () => {
    const signals = createMockSignals(1);
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test",
      signals,
      summary: "Summary",
      metadata: {
        signalCount: 1,
        signalTypes: ["ecosystem-growth"],
        avgConfidence: 0.8,
        generatorVersion: "1.0.0",
      },
    };
    const output = renderer.render(report, config);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("report_1");
    expect(parsed.title).toBe("Test");
    expect(parsed.signals.length).toBe(1);
  });

  it("pretty prints with 2-space indent", () => {
    const signals = createMockSignals(1);
    const report = {
      id: "report_1",
      generatedAt: Date.now(),
      title: "Test",
      signals,
      summary: "Summary",
      metadata: {
        signalCount: 1,
        signalTypes: ["ecosystem-growth"],
        avgConfidence: 0.8,
        generatorVersion: "1.0.0",
      },
    };
    const output = renderer.render(report, config);
    expect(output).toContain("\n  ");
    expect(output).toContain("\n    ");
  });
});

describe("ReportGenerator", () => {
  it("generates report with metadata and summary", () => {
    const gen = new ReportGenerator({ title: "Custom Title" });
    const signals = createMockSignals(3);
    const report = gen.generateReport(signals);

    expect(report.id).toMatch(/^report_\d+_[a-z0-9]+$/);
    expect(report.title).toBe("Custom Title");
    expect(report.signals).toEqual(signals);
    expect(report.summary).toContain("3 signal");
    expect(report.metadata.signalCount).toBe(3);
  });

  it("renders markdown by default", () => {
    const gen = new ReportGenerator();
    const signals = createMockSignals(2);
    const output = gen.generateAndRender(signals);
    expect(output).toContain("# Intelligence Report");
    expect(output).toContain("## Metadata");
  });

  it("renders html when requested", () => {
    const gen = new ReportGenerator({ format: "html" });
    const signals = createMockSignals(1);
    const output = gen.generateAndRender(signals);
    expect(output).toContain("<!DOCTYPE html>");
    expect(output).toContain("<html");
  });

  it("renders json when requested", () => {
    const gen = new ReportGenerator({ format: "json" });
    const signals = createMockSignals(1);
    const output = gen.generateAndRender(signals);
    const parsed = JSON.parse(output);
    expect(parsed.title).toBe("Intelligence Report");
  });

  it("renders empty signals deterministically", () => {
    const gen = new ReportGenerator({ title: "Empty Report" });
    const output1 = gen.generateAndRender([]);
    const output2 = gen.generateAndRender([]);
    expect(output1).toBe(output2);
  });

  it("generates deterministic output for same signals", () => {
    const gen = new ReportGenerator({ title: "Deterministic Test" });
    const signals = createMockSignals(3);
    const output1 = gen.generateAndRender(signals);
    const output2 = gen.generateAndRender(signals);
    expect(output1).toBe(output2);
  });

  it("includes all signal details in output", () => {
    const gen = new ReportGenerator({ includeSignalDetails: true });
    const signals = createMockSignals(1);
    const output = gen.generateAndRender(signals);
    expect(output).toContain("Supporting Evidence");
    expect(output).toContain("ev_1");
    expect(output).toContain("market-movement");
  });

  it("can override config per render call", () => {
    const gen = new ReportGenerator({ format: "markdown" });
    const signals = createMockSignals(1);
    const htmlOutput = gen.generateAndRender(signals, "html");
    const jsonOutput = gen.generateAndRender(signals, "json");
    expect(htmlOutput).toContain("<!DOCTYPE html>");
    expect(() => JSON.parse(jsonOutput)).not.toThrow();
  });

  it("getAvailableFormats returns all formats", () => {
    const gen = new ReportGenerator();
    expect(gen.getAvailableFormats()).toEqual(["markdown", "html", "json"]);
  });
});
