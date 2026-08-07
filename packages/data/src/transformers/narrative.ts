import type { Narrative, NarrativeTrend } from "@insight/core";
import type { RawNarrative } from "../interfaces/DataProvider";

/**
 * Narrative transformer — the only place raw narratives are mapped to core
 * {@link Narrative}. Pure and deterministic.
 */

const VALID_TRENDS: readonly NarrativeTrend[] = ["up", "down", "flat", "watch"];

function isTrend(value: string): value is NarrativeTrend {
  return (VALID_TRENDS as readonly string[]).includes(value);
}

function normalizeTrend(value: string | undefined, tone: RawNarrative["tone"]): NarrativeTrend {
  if (value !== undefined && isTrend(value)) {
    return value;
  }
  if (tone === "positive") {
    return "up";
  }
  if (tone === "negative") {
    return "down";
  }
  if (tone === "neutral") {
    return "watch";
  }
  return "flat";
}

/** Map a single raw narrative record to a core {@link Narrative}. */
export function transformNarrative(raw: RawNarrative): Narrative {
  return {
    id: raw.id,
    name: raw.name,
    trend: normalizeTrend(raw.trend, raw.tone),
    change: raw.change,
    note: raw.note ?? "",
    projectIds: raw.projectIds ?? [],
    evidenceIds: raw.evidenceIds ?? [],
  };
}

/** Map many raw records, preserving input order. */
export function transformNarrativeList(raw: readonly RawNarrative[]): Narrative[] {
  return raw.map(transformNarrative);
}

/** Deduplicate narratives by id, stable first-wins ordering. */
export function dedupeNarratives(narratives: readonly Narrative[]): Narrative[] {
  const byId = new Map<string, Narrative>();
  for (const narrative of narratives) {
    if (!byId.has(narrative.id)) {
      byId.set(narrative.id, narrative);
    }
  }
  return Array.from(byId.values());
}
