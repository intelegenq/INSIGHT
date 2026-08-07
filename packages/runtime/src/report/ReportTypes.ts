import type { IntelligenceSignal } from "@insight/intelligence";

/**
 * ReportTypes.ts — Core type definitions for the Report Generator layer.
 *
 * This layer transforms IntelligenceSignal arrays into human-readable artifacts.
 * No reasoning, no data fetching — pure presentation formatting.
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

export function generateReportId(): string {
  return `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Deterministic report ID generator for testing.
 * Uses a counter instead of randomness.
 */
let reportIdCounter = 0;
export function generateDeterministicReportId(): string {
  return `report_${Date.now()}_${++reportIdCounter}`;
}

/**
 * Deterministic timestamp generator for testing.
 * Uses a fixed base timestamp plus an incrementing counter.
 */
let timestampCounter = 0;
const BASE_TIMESTAMP = 1723032000000; // Fixed base: 2024-08-07T12:00:00.000Z
export function generateDeterministicTimestamp(): number {
  return BASE_TIMESTAMP + ++timestampCounter;
}

export function calculateReportMetadata(signals: IntelligenceSignal[]): ReportMetadata {
  const signalTypes = [...new Set(signals.map((s) => s.type))];
  const avgConfidence =
    signals.length > 0 ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length : 0;

  return {
    signalCount: signals.length,
    signalTypes,
    avgConfidence: Number(avgConfidence.toFixed(4)),
    generatorVersion: "1.0.0",
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
