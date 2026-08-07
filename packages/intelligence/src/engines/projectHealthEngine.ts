import type { Evidence, Project, ProjectMetrics } from "@insight/core";
import type { Bounds, Defaults, ProjectHealth, ScoredProject } from "../types";
import { weightEvidence } from "./evidenceEngine";

/**
 * ProjectHealthEngine — deterministic health, momentum, risk, and developer
 * scores for a project, derived from its cached metrics and evidence.
 *
 * Pure functions only. Reference date and bounds are passed in via
 * {@link Defaults} so all outputs are reproducible.
 */

export const DEFAULT_BOUNDS: Bounds = {
  maxTvl: 1_000_000_000,
  maxVolume: 200_000_000,
  maxActiveUsers: 100_000,
  maxDeveloperActivity: 50,
};

/** Score a single project's health profile. */
export function scoreProject(
  project: Project,
  evidence: readonly Evidence[],
  defaults: Defaults,
): ProjectHealth {
  const developer = developerScore(project.metrics, defaults);
  const risk = riskScore(project, evidence, defaults);
  const momentum = momentumScore(project.metrics, evidence, defaults);
  const health = healthScore(project, developer, evidence, defaults, risk);

  return {
    health: roundBounded(health, 0, 100),
    momentum: roundBounded(momentum, -100, 100),
    risk: roundBounded(risk, 0, 100),
    developer: roundBounded(developer, 0, 100),
  };
}

/** Enrich many projects with health profiles and resolved evidence. */
export function scoreProjects(
  projects: readonly Project[],
  evidenceById: ReadonlyMap<string, Evidence>,
  defaults: Defaults,
): ScoredProject[] {
  return projects.map((project) => {
    const evidence = resolveEvidenceFor(project, evidenceById);
    return {
      project,
      evidence,
      health: scoreProject(project, evidence, defaults),
    };
  });
}

function resolveEvidenceFor(
  project: Project,
  evidenceById: ReadonlyMap<string, Evidence>,
): Evidence[] {
  return project.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => item !== undefined);
}

/**
 * Health: combination of liquidity scale, activity, developer velocity, and
 * evidence support, discounted by elevated risk. Bounded [0,100].
 */
function healthScore(
  project: Project,
  developer: number,
  evidence: readonly Evidence[],
  defaults: Defaults,
  risk: number,
): number {
  const { maxTvl, maxVolume, maxActiveUsers } = defaults.bounds;
  const m = project.metrics;
  const tvl = scaleTo100(m.tvl ?? 0, maxTvl);
  const volume = scaleTo100(m.volume24h ?? 0, maxVolume);
  const users = scaleTo100(m.activeUsers24h ?? 0, maxActiveUsers);
  const support = evidence.length === 0 ? 0 : 100;

  const raw =
    0.3 * tvl + 0.2 * volume + 0.15 * users + 0.2 * developer + 0.15 * support - 0.25 * risk;
  return clamp(raw, 0, 100);
}

/**
 * Momentum: normalized evidence support plus developer velocity, projected
 * onto [-100, 100]. Direction falls out of how much support is active
 * relative to the amount that could exist for the resolved evidence.
 */
function momentumScore(
  metrics: ProjectMetrics,
  evidence: readonly Evidence[],
  defaults: Defaults,
): number {
  const support = weightEvidence(evidence, defaults.referenceDate);
  const possible = Math.max(evidence.length, 1);
  const share = clamp(support / possible, 0, 1);
  const developer = developerScore(metrics, defaults) / 100;

  const direction = share > 0.5 ? 1 : share < 0.2 ? -1 : 0;
  const magnitude = 0.5 * share + 0.5 * developer;
  return direction * magnitude * 100;
}

/** Developer velocity, bounded [0,100]. */
function developerScore(metrics: ProjectMetrics, defaults: Defaults): number {
  return scaleTo100(metrics.developerActivity ?? 0, defaults.bounds.maxDeveloperActivity);
}

/**
 * Risk: elevated when evidence is sparse, low-trust, or stale, and when the
 * project appears early/tiny. Bounded [0,100].
 */
function riskScore(project: Project, evidence: readonly Evidence[], defaults: Defaults): number {
  const uncovered = Math.max(0, project.evidenceIds.length - evidence.length);
  const sparsePenalty = uncovered > 0 ? uncovered * 20 : 0;
  const stalePenalty = evidence.some(
    (item) => defaults.referenceDate.length > 0 && ageInDays(item, defaults.referenceDate) > 90,
  )
    ? 30
    : 0;
  const earlyPenalty = project.metrics.tvl === undefined ? 15 : 0;

  return clamp(sparsePenalty + stalePenalty + earlyPenalty, 0, 100);
}

function ageInDays(item: Evidence, referenceDate: string): number {
  return (Date.parse(referenceDate) - Date.parse(item.observedAt)) / 86_400_000;
}

/** Normalize a raw value to [0,100] against a reference ceiling. */
function scaleTo100(value: number, max: number): number {
  if (max <= 0 || value <= 0) {
    return 0;
  }
  return clamp((value / max) * 100, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundBounded(value: number, min: number, max: number): number {
  return round(clamp(value, min, max), 1);
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
