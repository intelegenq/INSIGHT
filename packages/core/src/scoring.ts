import type { Confidence, Evidence, EvidenceStatus, Narrative, ReportConfidence } from "./types.js";

/**
 * Deterministic scoring utilities.
 *
 * All functions are pure and free of randomness and platform I/O. They are
 * intentionally simple: given the same inputs they always return the same
 * output, which keeps evidence-based scoring inspectable and testable.
 */

/** Weight used when a source is confirmed live rather than demo/pending. */
const VERIFIED_WEIGHT = 1;
const DEMO_WEIGHT = 0.25;
const PENDING_WEIGHT = 0.5;
const DRAFT_WEIGHT = 0.5;

function statusWeight(status: EvidenceStatus): number {
  switch (status) {
    case "verified":
      return VERIFIED_WEIGHT;
    case "pending":
      return PENDING_WEIGHT;
    case "draft":
      return DRAFT_WEIGHT;
    case "demo":
      return DEMO_WEIGHT;
  }
}

/** Sum of weighted evidence, a deterministic signal of support strength. */
export function evidenceWeight(evidence: readonly Evidence[]): number {
  return evidence.reduce((acc, item) => acc + statusWeight(item.status), 0);
}

/**
 * Derive a heuristic report confidence from the evidence backing it.
 *
 * Deterministic and monotonic: more verified evidence can only raise (or
 * leave unchanged) the confidence label.
 */
export function confidenceFromEvidence(evidence: readonly Evidence[]): ReportConfidence {
  const weight = evidenceWeight(evidence);
  if (evidence.length === 0) {
    return "illustrative";
  }
  if (weight >= 4) {
    return "high";
  }
  if (weight >= 2) {
    return "medium";
  }
  if (evidence.some((item) => item.status === "demo")) {
    return "draft";
  }
  return "illustrative";
}

/**
 * Rank narratives deterministically: trending narratives first, then by
 * descending change magnitude, then by name for a stable tiebreak.
 */
export function rankNarratives(narratives: readonly Narrative[]): Narrative[] {
  const trendOrder: Record<Narrative["trend"], number> = {
    up: 0,
    flat: 1,
    watch: 2,
    down: 3,
  };

  return [...narratives].sort((a, b) => {
    const trendDiff = trendOrder[a.trend] - trendOrder[b.trend];
    if (trendDiff !== 0) {
      return trendDiff;
    }
    const changeDiff = changeMagnitude(b) - changeMagnitude(a);
    if (changeDiff !== 0) {
      return changeDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

function changeMagnitude(narrative: Narrative): number {
  const change = narrative.change;
  if (change === undefined) {
    return -1;
  }
  const numeric = Number.parseFloat(change.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(numeric) ? -1 : Math.abs(numeric);
}

/**
 * Build a confidence range from the evidence backing a claim. Uses rounded
 * verified/total ratios so the result is deterministic and bounded to [0,1].
 */
export function confidenceRange(evidence: readonly Evidence[]): Confidence {
  const total = evidence.length;
  if (total === 0) {
    return { min: 0, max: 0 };
  }
  const verified = evidence.filter((item) => item.status !== "demo").length;
  const min = round2(verified / total);
  const max = round2(Math.max(min, evidenceWeight(evidence) / total));
  return { min, max };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
