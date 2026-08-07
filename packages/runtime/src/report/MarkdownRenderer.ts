import type { Report, ReportGeneratorConfig } from "./ReportTypes";

/**
 * MarkdownRenderer — Renders Report to Markdown format.
 *
 * Pure formatting, no reasoning.
 */

export class MarkdownRenderer {
  render(report: Report, config: ReportGeneratorConfig): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${report.title}`);
    lines.push("");

    // Metadata
    if (config.includeMetadata) {
      lines.push("## Metadata");
      lines.push("");
      lines.push(`- **Report ID:** ${report.id}`);
      lines.push(`- **Generated At:** ${new Date(report.generatedAt).toISOString()}`);
      lines.push(`- **Signal Count:** ${report.metadata.signalCount}`);
      lines.push(`- **Signal Types:** ${report.metadata.signalTypes.join(", ") || "—"}`);
      lines.push(`- **Avg Confidence:** ${(report.metadata.avgConfidence * 100).toFixed(1)}%`);
      lines.push(`- **Generator Version:** ${report.metadata.generatorVersion}`);
      lines.push("");
    }

    // Summary
    if (config.includeSummary) {
      lines.push("## Summary");
      lines.push("");
      lines.push(report.summary);
      lines.push("");
    }

    // Signals
    if (config.includeSignalDetails && report.signals.length > 0) {
      lines.push("## Signals");
      lines.push("");

      for (let i = 0; i < report.signals.length; i++) {
        const signal = report.signals[i]!;
        lines.push(`### ${i + 1}. ${signal.title}`);
        lines.push("");
        lines.push(`- **Type:** \`${signal.type}\``);
        lines.push(`- **Confidence:** ${(signal.confidence * 100).toFixed(1)}%`);
        lines.push(`- **Evidence Refs:** ${signal.evidenceIds.length}`);
        lines.push(`- **Timestamp:** ${new Date(signal.timestamp).toISOString()}`);
        lines.push("");
        lines.push(signal.description);
        lines.push("");

        if (signal.supportingEvidence && signal.supportingEvidence.length > 0) {
          lines.push("**Supporting Evidence:**");
          for (const ev of signal.supportingEvidence) {
            lines.push(
              `- ${ev.evidenceId}: ${ev.relationship} (weight: ${(ev.weight ?? 1).toFixed(2)})`,
            );
          }
          lines.push("");
        }

        if (signal.metadata) {
          lines.push("**Metadata:**");
          lines.push("```json");
          lines.push(JSON.stringify(signal.metadata, null, 2));
          lines.push("```");
          lines.push("");
        }
      }
    } else if (report.signals.length === 0) {
      lines.push("## Signals");
      lines.push("");
      lines.push("*No signals generated.*");
      lines.push("");
    }

    return lines.join("\n");
  }
}
