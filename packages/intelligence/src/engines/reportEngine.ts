import type {
  Evidence,
  Narrative,
  Report,
  ReportConfidence,
  ReportLens,
  ReportSections,
} from "@insight/core";
import { confidenceFromEvidence } from "@insight/core";
import type { Defaults, ScoredProject } from "../types";

/**
 * ReportEngine — generates a {@link Report} from evidence, scored projects,
 * and derived narratives.
 *
 * Deterministic: the same inputs always yield the same report, including a
 * stable title and sections derived only from the retained data.
 */

/** Lens keywords used to pick the most relevant narrative for a report. */
const LENS_KEYWORDS: Record<ReportLens, readonly string[]> = {
  ecosystem: ["Ecosystem", "Consumer", "DeFi"],
  defi: ["DeFi"],
  infrastructure: ["Infrastructure"],
};

/**
 * Generate a report through a given lens. Narrative and project health
 * profiles power the thesis, catalysts, and risks; confidence comes from the
 * backing evidence alone.
 */
export function generateReport(params: {
  lens: ReportLens;
  projects: readonly ScoredProject[];
  narratives: readonly { narrative: Narrative; momentum: number }[];
  evidenceById: ReadonlyMap<string, Evidence>;
  defaults: Defaults;
}): Report {
  const { lens, projects, narratives, evidenceById, defaults } = params;
  const evidence = collectEvidence(projects, evidenceById);
  const relevantNarrative = pickNarrative(narratives, lens);
  const strongest = strongestProject(projects);
  const confidence = confidenceFromEvidence(evidence);
  const sections = buildSections(relevantNarrative, strongest, lens, confidence);
  const isDemo = evidence.length === 0 ? true : evidence.some((item) => item.status === "demo");

  return {
    id: `report-${lens}`,
    lens,
    title: buildTitle(lens, relevantNarrative),
    sections,
    evidenceIds: evidence.map((item) => item.id),
    confidence,
    generatedAt: defaults.referenceDate,
    isDemo,
  };
}

/** Deterministically choose the narrative most aligned with the lens. */
function pickNarrative(
  narratives: readonly { narrative: Narrative; momentum: number }[],
  lens: ReportLens,
): { narrative: Narrative; momentum: number } | undefined {
  const keywords = LENS_KEYWORDS[lens];
  let best: { narrative: Narrative; momentum: number } | undefined;
  for (const candidate of narratives) {
    if (keywords.some((keyword) => candidate.narrative.name.includes(keyword))) {
      if (best === undefined || candidate.momentum > best.momentum) {
        best = candidate;
      }
    }
  }
  return best;
}

/** The healthiest project in scope, or undefined when empty. */
function strongestProject(projects: readonly ScoredProject[]): ScoredProject | undefined {
  let best: ScoredProject | undefined;
  for (const scored of projects) {
    if (best === undefined || scored.health.health > best.health.health) {
      best = scored;
    }
  }
  return best;
}

/** Collect the union of evidence backing every project in scope. */
function collectEvidence(
  projects: readonly ScoredProject[],
  evidenceById: ReadonlyMap<string, Evidence>,
): Evidence[] {
  const seen = new Set<string>();
  const result: Evidence[] = [];
  for (const scored of projects) {
    for (const id of scored.project.evidenceIds) {
      if (seen.has(id)) {
        continue;
      }
      const item = evidenceById.get(id);
      if (item !== undefined) {
        seen.add(id);
        result.push(item);
      }
    }
  }
  return result;
}

function buildTitle(lens: ReportLens, narrative: { narrative: Narrative } | undefined): string {
  const lensLabel = lensLabelFor(lens);
  if (narrative !== undefined) {
    return `${narrative.narrative.name} · ${capitalize(lensLabel)} brief`;
  }
  return `Solana ${lensLabel} brief`;
}

/** Build report sections derived only from available data. */
function buildSections(
  narrative: { narrative: Narrative; momentum: number } | undefined,
  strongestProject: ScoredProject | undefined,
  lens: ReportLens,
  confidence: ReportConfidence,
): ReportSections {
  const label = capitalize(lensLabelFor(lens));

  const thesis = narrative
    ? `${narrative.narrative.note} The leading signal here carries ${formatMomentum(
        narrative.momentum,
      )}.`
    : `No dominant ${label.toLowerCase()} narrative emerged from the current evidence set.`;

  const catalyst =
    strongestProject === undefined
      ? `More evidence is needed to identify concrete catalysts in the ${label.toLowerCase()} landscape.`
      : `Watch ${strongestProject.project.name}: its health score is ${Math.round(
          strongestProject.health.health,
        )}/100 and its risk is ${Math.round(strongestProject.health.risk)}/100.`;

  const risk = `Risk reflects evidence trust and coverage; confidence is currently ${confidence}, so treat conclusions as provisional.`;

  return { thesis, catalyst, risk };
}

function lensLabelFor(lens: ReportLens): string {
  switch (lens) {
    case "ecosystem":
      return "ecosystem";
    case "defi":
      return "DeFi";
    case "infrastructure":
      return "infrastructure";
  }
}

function capitalize(input: string): string {
  return input.length === 0 ? input : input.charAt(0).toUpperCase() + input.slice(1);
}

function formatMomentum(momentum: number): string {
  const rounded = Math.round(momentum);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}
