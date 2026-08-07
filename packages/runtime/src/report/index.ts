/**
 * Report barrel export.
 */

export { ReportGenerator } from "./ReportGenerator";
export { MarkdownRenderer } from "./MarkdownRenderer";
export { HtmlRenderer } from "./HtmlRenderer";
export { JsonRenderer } from "./JsonRenderer";
export type { Report, ReportFormat, ReportMetadata, ReportGeneratorConfig } from "./ReportTypes";
export {
  DEFAULT_REPORT_CONFIG,
  generateReportId,
  calculateReportMetadata,
  generateSummary,
} from "./ReportTypes";
