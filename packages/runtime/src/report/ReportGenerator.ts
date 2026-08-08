import type { IntelligenceSignal } from "@insight/intelligence";
import type { Report, ReportGeneratorConfig, ReportFormat } from "./ReportTypes";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { HtmlRenderer } from "./HtmlRenderer";
import { JsonRenderer } from "./JsonRenderer";
import {
  DEFAULT_REPORT_CONFIG,
  buildDeterministicGeneratedAt,
  buildDeterministicReportId,
  calculateReportMetadata,
  generateSummary,
} from "./ReportTypes";
import { validateEnum, assertValid } from "../validation";

/**
 * ReportGenerator — Orchestrates report generation from intelligence signals.
 *
 * Responsibilities:
 * - Accept IntelligenceSignal[] and config
 * - Generate Report object with metadata and summary
 * - Delegate rendering to format-specific renderers
 * - No reasoning, no data fetching — pure assembly
 *
 * The generator is fully deterministic: given the same signals and config
 * the produced Report is byte-for-byte identical across runs.
 */

export class ReportGenerator {
  private config: Required<ReportGeneratorConfig>;
  private markdownRenderer: MarkdownRenderer;
  private htmlRenderer: HtmlRenderer;
  private jsonRenderer: JsonRenderer;

  constructor(config: ReportGeneratorConfig = {}) {
    // Validate config format if provided
    if (config.format) {
      assertValid(
        validateEnum(config.format, ["markdown", "html", "json"], "format"),
        "ReportGenerator.constructor",
      );
    }

    this.config = { ...DEFAULT_REPORT_CONFIG, ...config };
    this.markdownRenderer = new MarkdownRenderer();
    this.htmlRenderer = new HtmlRenderer();
    this.jsonRenderer = new JsonRenderer();
  }

  /** Generate a full Report object from signals. */
  generateReport(signals: IntelligenceSignal[]): Report {
    const metadata = calculateReportMetadata(signals);
    const summary = this.config.includeSummary ? generateSummary(signals) : "Summary disabled.";

    return {
      id: buildDeterministicReportId(signals, this.config.title),
      generatedAt: buildDeterministicGeneratedAt(signals, this.config.title),
      title: this.config.title,
      signals,
      summary,
      metadata,
    };
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
