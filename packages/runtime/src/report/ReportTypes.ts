import type { IntelligenceSignal } from "@insight/intelligence";

/**
 * ReportTypes.ts — Core type definitions for the Report Generator layer.
 *
 * This layer transforms IntelligenceSignal arrays into human-readable artifacts.
 * No reasoning, no data fetching — pure presentation formatting.
 *
 * All ID and timestamp generation is deterministic and content-derived. No
 * wall-clock reads, no randomness. This makes reports reproducible across
 * runs and friendly to snapshot diffing and golden-file testing.
 */

export type ReportFormat = "markdown" | "html" | "json";

export interface ReportMetadata {
  signalCount: number;
  signalTypes: string[];
  avgConfidence: number;
  generatorVersion: string;
}

export interface Report {
  id: string;
  generatedAt: number;
  title: string;
  signals: IntelligenceSignal[];
  summary: string;
  metadata: ReportMetadata;
}

export interface ReportGeneratorConfig {
  title?: string;
  format?: ReportFormat;
  includeSummary?: boolean;
  includeMetadata?: boolean;
  includeSignalDetails?: boolean;
}

export const DEFAULT_REPORT_CONFIG: Required<ReportGeneratorConfig> = {
  title: "Intelligence Report",
  format: "markdown",
  includeSummary: true,
  includeMetadata: true,
  includeSignalDetails: true,
};

export const REPORT_GENERATOR_VERSION = "1.0.0";

/**
 * Build a deterministic report id from the report's content payload.
 *
 * The id encodes the title, signal identifiers, and a content hash, so the
 * same input always produces the same id. The optional `suffix` lets
 * callers guarantee uniqueness when a single payload needs to be reported
 * on multiple times (e.g. separate runs of an identical input).
 */
export function buildDeterministicReportId(
  signals: readonly IntelligenceSignal[],
  title: string,
  suffix?: string,
): string {
  const signalIds = [...signals.map((s) => s.id)].sort();
  const payload = `${title}|${signalIds.join(",")}`;
  const hash = fnv1a32(payload).toString(16).padStart(8, "0");
  if (suffix === undefined || suffix.length === 0) {
    return `report-${hash}`;
  }
  return `report-${hash}-${suffix}`;
}

/**
 * Build a deterministic generatedAt timestamp for a report.
 *
 * Combines a fixed epoch (the Insight M0 milestone: 2024-08-07T12:00:00Z)
 * with a content-derived offset so equal inputs always yield equal
 * timestamps. The offset is bounded so the value stays within a sane
 * range and never collides with real wall-clock values.
 */
export function buildDeterministicGeneratedAt(
  signals: readonly IntelligenceSignal[],
  title: string,
): number {
  const payload = `${title}|${signals.length}|${signals[0]?.id ?? ""}`;
  const offset = fnv1a32(payload) % 1_000_000; // bounded, deterministic offset
  return REPORT_EPOCH_MS + offset;
}

/**
 * Fixed reference epoch for deterministic timestamps.
 * 2024-08-07T12:00:00.000Z — chosen as the Insight M0 milestone anchor.
 */
export const REPORT_EPOCH_MS = 1_723_032_000_000;

/**
 * Compute the report metadata block from a list of signals.
 */
export function calculateReportMetadata(signals: IntelligenceSignal[]): ReportMetadata {
  const signalTypes = [...new Set(signals.map((s) => s.type))];
  const avgConfidence =
    signals.length > 0 ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length : 0;

  return {
    signalCount: signals.length,
    signalTypes,
    avgConfidence: Number(avgConfidence.toFixed(4)),
    generatorVersion: REPORT_GENERATOR_VERSION,
  };
}

export function generateSummary(signals: IntelligenceSignal[]): string {
  if (signals.length === 0) {
    return "No intelligence signals generated for this period.";
  }

  const typeCounts = signals.reduce(
    (acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const topTypes = Object.entries(typeCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([type, count]) => `${type} (${count})`)
    .join(", ");

  const highConfidence = signals.filter((s) => s.confidence >= 0.7).length;
  const totalEvidence = signals.reduce((sum, s) => sum + s.evidenceIds.length, 0);

  return `Generated ${signals.length} signal(s) across ${topTypes}. ${highConfidence} high-confidence signal(s). Based on ${totalEvidence} total evidence reference(s).`;
}

/** FNV-1a 32-bit hash. Mirrors the implementation in Snapshot.ts. */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
