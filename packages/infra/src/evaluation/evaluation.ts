/**
 * @insight/infra/evaluation — deterministic report/evidence evaluation.
 *
 * Builds on @insight/core scoring (STATUS_WEIGHT, evidenceWeight,
 * confidenceFromEvidence) to produce a deterministic quality assessment of
 * reports and their backing evidence. Pure functions only — no I/O, no
 * randomness, no wall-clock reads.
 */
import type { Evidence, ReportConfidence } from "@insight/core";
import { confidenceFromEvidence, evidenceWeight } from "@insight/core";

/** Per-records of evidence quality evaluation. */
export interface EvidenceVerdict {
  total: number;
  verified: number;
  demo: number;
  weight: number;
  confidence: ReportConfidence;
}

/**
 * Deterministically evaluate a list of evidence items.
 * All outputs flow from the inputs (no randomness/timestamps).
 */
export function evaluateEvidence(evidence: readonly Evidence[]): EvidenceVerdict {
  const verified = evidence.filter((e) => e.status === "verified").length;
  const demo = evidence.filter((e) => e.status === "demo").length;
  return {
    total: evidence.length,
    verified,
    demo,
    weight: evidenceWeight(evidence),
    confidence: confidenceFromEvidence(evidence),
  };
}

/** Deterministic quality label derived from evidence confidence. */
export type ReportQuality = "poor" | "fair" | "good";

/** Result of evaluating a report plus its backing evidence. */
export interface ReportVerdict {
  reportId: string;
  confidence: ReportConfidence;
  evidence: EvidenceVerdict;
  /** 1 when any verified evidence exists, else 0 (deterministic). */
  hasVerifiedEvidence: boolean;
  /** Overall quality label. */
  quality: ReportQuality;
}

/**
 * Evaluate a report against its referenced evidence. Deterministic: the
 * verdict depends solely on the supplied confidence and evidence.
 */
export function evaluateReport(input: {
  reportId: string;
  confidence: ReportConfidence;
  evidence: readonly Evidence[];
}): ReportVerdict {
  const evidence = evaluateEvidence(input.evidence);
  const hasVerifiedEvidence = evidence.verified > 0;
  const quality: ReportQuality = input.confidence === "high"
    ? "good"
    : input.confidence === "medium"
      ? "fair"
      : "poor";
  return {
    reportId: input.reportId,
    confidence: input.confidence,
    evidence,
    hasVerifiedEvidence,
    quality,
  };
}

/** True when an evidence set meets a minimum verified floor. */
export function meetsVerifiedFloor(evidence: readonly Evidence[], floor: number): boolean {
  return evidence.filter((e) => e.status === "verified").length >= floor;
}