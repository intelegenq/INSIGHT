import type { Report, ReportGeneratorConfig } from "./ReportTypes";

/**
 * JsonRenderer — Renders Report to pretty JSON.
 *
 * Pure formatting, no reasoning.
 */

export class JsonRenderer {
  render(report: Report, _config: ReportGeneratorConfig): string {
    return JSON.stringify(report, null, 2);
  }
}
