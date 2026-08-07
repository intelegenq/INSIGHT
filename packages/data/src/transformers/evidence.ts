import type { Evidence, EvidenceStatus } from "@insight/core";
import type { RawEvidence } from "../interfaces/DataProvider";

/**
 * Evidence transformer — the only place raw evidence is mapped to core
 * {@link Evidence}. Pure and deterministic: identical raw input always
 * yields identical core output.
 */

const STATUS_ORDER: Record<EvidenceStatus, number> = {
  verified: 3,
  pending: 2,
  draft: 1,
  demo: 0,
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isStatus(value: string): value is EvidenceStatus {
  return value === "verified" || value === "pending" || value === "draft" || value === "demo";
}

function normalizeStatus(value: string | undefined): EvidenceStatus {
  if (value !== undefined && isStatus(value)) {
    return value;
  }
  return "demo";
}

/** Map a single raw evidence record to a core {@link Evidence}. */
export function transformEvidence(raw: RawEvidence): Evidence {
  const sourceId = raw.sourceId ?? slugify(raw.sourceName ?? "unknown-source");
  return {
    id: raw.id,
    source: {
      id: sourceId,
      name: raw.sourceName ?? sourceId,
    },
    note: raw.note ?? "",
    status: normalizeStatus(raw.status),
    observedAt: raw.observedAt ?? "1970-01-01T00:00:00.000Z",
    reference: raw.reference,
  };
}

/** Map many raw records, preserving input order. */
export function transformEvidenceList(raw: readonly RawEvidence[]): Evidence[] {
  return raw.map(transformEvidence);
}

/** Deterministically pick the highest-trust record for duplicate ids. */
export function pickBestEvidence(a: Evidence, b: Evidence): Evidence {
  const aRank = STATUS_ORDER[a.status] ?? 0;
  const bRank = STATUS_ORDER[b.status] ?? 0;
  if (aRank !== bRank) {
    return aRank > bRank ? a : b;
  }
  if (a.observedAt > b.observedAt) {
    return a;
  }
  if (a.observedAt < b.observedAt) {
    return b;
  }
  return a.id.localeCompare(b.id) <= 0 ? a : b;
}

/** Deduplicate evidence by id using {@link pickBestEvidence}. */
export function dedupeEvidence(evidence: readonly Evidence[]): Evidence[] {
  const byId = new Map<string, Evidence>();
  for (const item of evidence) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing === undefined ? item : pickBestEvidence(existing, item));
  }
  return Array.from(byId.values());
}
