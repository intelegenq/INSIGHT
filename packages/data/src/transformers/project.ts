import type { EntityClassification, Project, ProjectCategory, ProjectMetrics } from "@insight/core";
import type { RawProject } from "../interfaces/DataProvider";

/**
 * Project transformer — the only place raw projects are mapped to core
 * {@link Project}. Pure and deterministic.
 */

const VALID_CATEGORIES: readonly ProjectCategory[] = [
  "defi",
  "dex",
  "lending",
  "yield",
  "liquid-staking",
  "bridge",
  "derivatives",
  "payments",
  "nft",
  "oracle",
  "rwa",
  "gaming",
  "social",
  "wallets",
  "infrastructure",
  "ai",
  "depin",
  "stablecoins",
  "restaking",
  "mev",
  "validators",
  "data",
  "security",
  "developer-tools",
  "consumer",
  "other",
];

const VALID_CLASSIFICATIONS: readonly EntityClassification[] = [
  "solana_ecosystem",
  "market_context",
  "network",
];

function isCategory(value: string): value is ProjectCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(value);
}

function isClassification(value: string): value is EntityClassification {
  return (VALID_CLASSIFICATIONS as readonly string[]).includes(value);
}

function normalizeCategory(value: string | undefined): ProjectCategory {
  if (value !== undefined && isCategory(value)) {
    return value;
  }
  return "other";
}

function normalizeClassification(value: string | undefined): EntityClassification | undefined {
  if (value !== undefined && isClassification(value)) {
    return value;
  }
  return undefined;
}

function normalizeMetrics(raw: RawProject["metrics"]): ProjectMetrics {
  return {
    tvl: raw?.tvl,
    volume24h: raw?.volume24h,
    activeUsers24h: raw?.activeUsers24h,
    developerActivity: raw?.developerActivity,
  };
}

/** Map a single raw project record to a core {@link Project}. */
export function transformProject(raw: RawProject): Project {
  const transformed: Project = {
    id: raw.id,
    name: raw.name,
    category: normalizeCategory(raw.category),
    description: raw.description ?? "",
    metrics: normalizeMetrics(raw.metrics),
    evidenceIds: raw.evidenceIds ?? [],
    updatedAt: raw.updatedAt ?? "1970-01-01T00:00:00.000Z",
  };

  const classification = normalizeClassification(raw.classification);
  if (classification !== undefined) {
    transformed.classification = classification;
  }

  return transformed;
}

/** Map many raw records, preserving input order. */
export function transformProjectList(raw: readonly RawProject[]): Project[] {
  return raw.map(transformProject);
}

/** Deterministically pick the record for duplicate ids (first wins). */
export function pickFirstProject(projects: readonly Project[], id: string): Project | undefined {
  return projects.find((project) => project.id === id);
}

/** Deduplicate projects by id, stable first-wins ordering. */
export function dedupeProjects(projects: readonly Project[]): Project[] {
  const byId = new Map<string, Project>();
  for (const project of projects) {
    if (!byId.has(project.id)) {
      byId.set(project.id, project);
    }
  }
  return Array.from(byId.values());
}
