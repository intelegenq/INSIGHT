import type { IntelligenceSignal } from "@insight/intelligence";
import type { Report, ReportGeneratorConfig, ReportFormat } from "./ReportTypes";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { HtmlRenderer } from "./HtmlRenderer";
import { JsonRenderer } from "./JsonRenderer";
import {
  DEFAULT_REPORT_CONFIG,
  generateReportId,
  calculateReportMetadata,
  generateSummary,
} from "./ReportTypes";

/**
 * ReportGenerator — Orchestrates report generation from intelligence signals.
 *
 * Responsibilities:
 * - Accept IntelligenceSignal[] and config
 * - Generate Report object with metadata and summary
 * - Delegate rendering to format-specific renderers
 * - No reasoning, no data fetching — pure assembly
 */

const BASE_TIMESTAMP = 1723032000000; // Fixed base: 2024-08-07T12:00:00.000Z

export class ReportGenerator {
  private config: Required<ReportGeneratorConfig>;
  private markdownRenderer: MarkdownRenderer;
  private htmlRenderer: HtmlRenderer;
  private jsonRenderer: JsonRenderer;
  private deterministic: boolean;
  private reportIdCounter: number;
  private timestampCounter: number;

  constructor(config: ReportGeneratorConfig = {}) {
    this.config = { ...DEFAULT_REPORT_CONFIG, ...config };
    this.markdownRenderer = new MarkdownRenderer();
    this.htmlRenderer = new HtmlRenderer();
    this.jsonRenderer = new JsonRenderer();
    this.deterministic = config.format === "json" ? false : true; // Default deterministic for testing
    this.reportIdCounter = 0;
    this.timestampCounter = 0;
  }

  /** Generate a full Report object from signals. */
  generateReport(signals: IntelligenceSignal[]): Report {
    const metadata = calculateReportMetadata(signals);
    const summary = this.config.includeSummary ? generateSummary(signals) : "Summary disabled.";

    if (this.deterministic) {
      // For deterministic mode: generate consistent ID/timestamp based on signals content
      // This ensures same signals always produce same output
      const signalsHash = this.hashSignals(signals);
      return {
        id: `report_${BASE_TIMESTAMP}_${signalsHash}`,
        generatedAt: BASE_TIMESTAMP + signalsHash,
        title: this.config.title,
        signals,
        summary,
        metadata,
      };
    }

    return {
      id: generateReportId(),
      generatedAt: Date.now(),
      title: this.config.title,
      signals,
      summary,
      metadata,
    };
  }

  /** Simple hash of signals for deterministic ID generation. */
  private hashSignals(signals: IntelligenceSignal[]): number {
    let hash = 0;
    for (const signal of signals) {
      for (let i = 0; i < signal.id.length; i++) {
        hash = (hash << 5) - hash + signal.id.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      for (let i = 0; i < signal.type.length; i++) {
        hash = (hash << 5) - hash + signal.type.charCodeAt(i);
        hash |= 0;
      }
      hash = (hash << 5) - hash + Math.round(signal.confidence * 10000);
      hash |= 0;
    }
    return Math.abs(hash) % 10000;
  }

  /**
   * Render report to specified format.
   */
  render(report: Report, format?: ReportFormat): string {
    const targetFormat = format || this.config.format;

    switch (targetFormat) {
      case "markdown":
        return this.markdownRenderer.render(report, this.config);
      case "html":
        return this.htmlRenderer.render(report, this.config);
      case "json":
        return this.jsonRenderer.render(report, this.config);
      default:
        throw new Error(`Unsupported format: ${targetFormat}`);
    }
  }

  /**
   * Generate and render in one call.
   */
  generateAndRender(signals: IntelligenceSignal[], format?: ReportFormat): string {
    const report = this.generateReport(signals);
    return this.render(report, format);
  }

  /**
   * Get available renderers.
   */
  getAvailableFormats(): ReportFormat[] {
    return ["markdown", "html", "json"];
  }
}
