import type { Evidence, Narrative, NarrativeTrend, Project } from "@insight/core";
import type { Defaults, DerivedNarrative } from "../types";
import { scoreProject } from "./projectHealthEngine";

/**
 * NarrativeEngine — deterministically derives narratives from projects and
 * their backing evidence.
 *
 * Narratives are grouped by project category and described using only the
 * resolved data, so identical inputs always produce identical narratives.
 */

/** Trend threshold: momentum above this is "up", below negative is "down". */
const TREND_UP_THRESHOLD = 25;
const TREND_DOWN_THRESHOLD = -25;

const CATEGORY_LABEL: Record<Project["category"], string> = {
  defi: "DeFi",
  dex: "DEX",
  lending: "Lending",
  yield: "Yield",
  "liquid-staking": "Liquid Staking",
  bridge: "Bridge",
  derivatives: "Derivatives",
  payments: "Payments",
  nft: "NFT",
  oracle: "Oracles",
  rwa: "RWA",
  gaming: "Gaming",
  social: "Social",
  wallets: "Wallets",
  infrastructure: "Infrastructure",
  ai: "AI",
  depin: "DePIN",
  stablecoins: "Stablecoins",
  restaking: "Restaking",
  mev: "MEV",
  validators: "Validators",
  data: "Data",
  security: "Security",
  "developer-tools": "Developer Tools",
  consumer: "Consumer",
  other: "Ecosystem",
};

/**
 * Build one narrative per project category present in the input.
 * Each narrative carries the projects and evidence that support it.
 */
export function deriveNarratives(
  projects: readonly Project[],
  evidenceById: ReadonlyMap<string, Evidence>,
  defaults: Defaults,
): DerivedNarrative[] {
  const byCategory = new Map<Project["category"], Project[]>();
  for (const project of projects) {
    const bucket = byCategory.get(project.category) ?? [];
    bucket.push(project);
    byCategory.set(project.category, bucket);
  }

  const derived: DerivedNarrative[] = [];
  for (const [category, categoryProjects] of byCategory) {
    derived.push(deriveCategoryNarrative(category, categoryProjects, evidenceById, defaults));
  }
  return derived.sort(
    (a, b) => b.momentum - a.momentum || a.narrative.name.localeCompare(b.narrative.name),
  );
}

/** Build a single narrative for a category of projects. */
export function deriveCategoryNarrative(
  category: Project["category"],
  projects: readonly Project[],
  evidenceById: ReadonlyMap<string, Evidence>,
  defaults: Defaults,
): DerivedNarrative {
  const projectIds: string[] = [];
  const evidenceIds: string[] = [];
  const momentumValues: number[] = [];

  for (const project of projects) {
    projectIds.push(project.id);
    for (const id of project.evidenceIds) {
      if (evidenceById.has(id) && !evidenceIds.includes(id)) {
        evidenceIds.push(id);
      }
    }
    const evidence = project.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((item): item is Evidence => item !== undefined);
    momentumValues.push(scoreProject(project, evidence, defaults).momentum);
  }

  const aggregateMomentum = average(momentumValues);
  const trend = trendFromMomentum(aggregateMomentum);
  const id = `narrative-${category}`;
  const name = CATEGORY_LABEL[category];

  const narrative: Narrative = {
    id,
    name,
    trend,
    change: formatChange(aggregateMomentum, trend),
    note: buildNote(category, projects.length, evidenceIds.length, aggregateMomentum),
    projectIds,
    evidenceIds,
  };

  return { narrative, momentum: aggregateMomentum };
}

/** Derive a single narrative for one project (helper for focused analysis). */
export function deriveNarrativeForProject(
  project: Project,
  evidence: readonly Evidence[],
  defaults: Defaults,
): DerivedNarrative {
  const projectIds = [project.id];
  const evidenceIds = evidence.map((item) => item.id);
  const momentum = scoreProject(project, evidence, defaults).momentum;
  const trend = trendFromMomentum(momentum);

  const narrative: Narrative = {
    id: `narrative-${project.id}`,
    name: project.name,
    trend,
    change: formatChange(momentum, trend),
    note: `${project.description} Based on ${evidence.length} backing evidence signal${
      evidence.length === 1 ? "" : "s"
    }.`,
    projectIds,
    evidenceIds,
  };

  return { narrative, momentum };
}

function trendFromMomentum(momentum: number): NarrativeTrend {
  if (momentum >= TREND_UP_THRESHOLD) {
    return "up";
  }
  if (momentum <= TREND_DOWN_THRESHOLD) {
    return "down";
  }
  return "flat";
}

function formatChange(momentum: number, trend: NarrativeTrend): string | undefined {
  if (trend === "up") {
    return `+${round(momentum, 1)}%`;
  }
  if (trend === "down") {
    return `${round(momentum, 1)}%`;
  }
  return undefined;
}

function buildNote(
  category: Project["category"],
  projectCount: number,
  evidenceCount: number,
  momentum: number,
): string {
  const label = CATEGORY_LABEL[category];
  const direction = momentum >= 0 ? "positive" : "negative";
  return `${label} narrative across ${projectCount} project${
    projectCount === 1 ? "" : "s"
  }, supported by ${evidenceCount} evidence signal${evidenceCount === 1 ? "" : "s"} with ${direction} momentum.`;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
