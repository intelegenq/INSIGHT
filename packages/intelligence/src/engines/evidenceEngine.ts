import type { Evidence, EvidenceStatus } from "@insight/core";
import type { EvidenceFeedRecord } from "../types";

/**
 * EvidenceEngine — normalizes raw feed records, deduplicates them, and
 * computes deterministic weights.
 *
 * Pure functions only: no I/O, no randomness, no wall-clock reads. Every
 * operation is derived solely from its arguments.
 */

const STATUS_ORDER: Record<EvidenceStatus, number> = {
  verified: 3,
  pending: 2,
  draft: 1,
  demo: 0,
};

/** Weights reflecting trust in each evidence status. */
export const STATUS_WEIGHT: Record<EvidenceStatus, number> = {
  verified: 1,
  pending: 0.6,
  draft: 0.45,
  demo: 0.25,
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSourceValue(
  source: string | { id?: string; name?: string } | undefined,
): Evidence["source"] {
  if (source === undefined) {
    return { id: "unknown-source", name: "Unknown source" };
  }
  if (typeof source === "string") {
    return { id: slugify(source), name: source };
  }
  return {
    id: source.id ?? slugify(source.name ?? "unknown-source"),
    name: source.name ?? source.id ?? "Unknown source",
  };
}

/**
 * Normalize loosely-shaped feed records into typed {@link Evidence} objects.
 * Missing fields receive deterministic defaults.
 */
export function normalizeEvidence(records: readonly EvidenceFeedRecord[]): Evidence[] {
  return records.map((record, index) => {
    const source = normalizeSourceValue(record.source);
    return {
      id: record.id ?? `evidence-${index}`,
      source,
      note: record.note ?? "",
      status: record.status ?? "demo",
      observedAt: record.observedAt ?? "1970-01-01T00:00:00.000Z",
      reference: record.reference,
    };
  });
}

/**
 * Deduplicate evidence by identifier. When multiple records share an id,
 * the record with the highest status (verified > pending > draft > demo) is
 * kept; ties break by latest observedAt, then lexicographically smallest id.
 */
export function deduplicateEvidence(evidence: readonly Evidence[]): Evidence[] {
  const byId = new Map<string, Evidence>();
  for (const item of evidence) {
    const existing = byId.get(item.id);
    if (existing === undefined || isPreferred(item, existing)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

function isPreferred(candidate: Evidence, current: Evidence): boolean {
  const statusDelta = statusOrder(candidate.status) - statusOrder(current.status);
  if (statusDelta !== 0) {
    return statusDelta > 0;
  }
  if (candidate.observedAt > current.observedAt) {
    return true;
  }
  if (candidate.observedAt < current.observedAt) {
    return false;
  }
  return candidate.id.localeCompare(current.id) <= 0;
}

function statusOrder(status: EvidenceStatus): number {
  return STATUS_ORDER[status] ?? 0;
}

/** Remove duplicate content across distinct ids (same source + note). */
export function deduplicateContent(evidence: readonly Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const result: Evidence[] = [];
  for (const item of evidence) {
    const key = `${item.source.id}::${item.note}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Compute a deterministic support weight for a set of evidence.
 * Higher-status evidence contributes more; fresher evidence decays toward
 * zero over time. `referenceDate` is explicit so results are reproducible.
 */
export function weightEvidence(
  evidence: readonly Evidence[],
  referenceDate: string,
  halfLifeDays = 30,
): number {
  const referenceMs = Date.parse(referenceDate);
  const total = evidence.reduce((sum, item) => {
    const statusWeight = statusWeightFor(item.status);
    const ageDays = Math.max(0, (referenceMs - Date.parse(item.observedAt)) / 86_400_000);
    const freshness = Math.pow(0.5, ageDays / halfLifeDays);
    return sum + statusWeight * freshness;
  }, 0);
  return round(total, 4);
}

/** Highest-weight evidence record, or undefined for an empty set. */
export function bestEvidence(evidence: readonly Evidence[]): Evidence | undefined {
  let best: Evidence | undefined;
  let bestWeight = -1;
  for (const item of evidence) {
    const w = statusWeightFor(item.status);
    if (
      best === undefined ||
      w > bestWeight ||
      (w === bestWeight && item.observedAt > best.observedAt)
    ) {
      best = item;
      bestWeight = w;
    }
  }
  return best;
}

function statusWeightFor(status: EvidenceStatus): number {
  return STATUS_WEIGHT[status] ?? 0;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
