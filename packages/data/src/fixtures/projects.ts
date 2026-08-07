import type { Evidence, Project } from "@insight/core";
import { demoEvidence } from "../sources/demo";
import type { DemoEvidenceSource } from "../sources/types";

/**
 * Evidence fixtures.
 *
 * Demo source records are normalized into core {@link Evidence} domain
 * objects. This keeps the repository boundary typed and stable regardless
 * of missing or loosely-shaped source fields.
 */

const evidenceRecord = demoEvidence.reduce<Record<string, DemoEvidenceSource>>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

function demoTopicEvidence(source: DemoEvidenceSource, topic: string): Evidence {
  return {
    id: source.id,
    source: { id: `source-${source.id}`, name: source.source },
    note: source.note,
    status: source.status,
    observedAt: "2026-08-07T09:40:00.000Z",
    reference: `demo:${topic}:${source.id}`,
  };
}

function requireSource(id: string): DemoEvidenceSource {
  const source = evidenceRecord[id];
  if (source === undefined) {
    throw new Error(`Missing demo evidence source: ${id}`);
  }
  return source;
}

export const evidenceByTopic = {
  telemetry: demoTopicEvidence(requireSource("evidence-telemetry"), "telemetry"),
  developer: demoTopicEvidence(requireSource("evidence-developer"), "developer"),
  monitoring: demoTopicEvidence(requireSource("evidence-monitoring"), "monitoring"),
};

/** Example projects surfaced on the intelligence surface. */
export const projects: Project[] = [
  {
    id: "proj-lending",
    name: "Illustrative Lending Pool",
    category: "defi",
    description:
      "A demo lending protocol whose utilization and TVL are representative of the broader ecosystem pulse.",
    metrics: {
      tvl: 1_240_000_000,
      volume24h: 86_000_000,
      activeUsers24h: 14_200,
      developerActivity: 8,
    },
    evidenceIds: ["evidence-telemetry"],
    updatedAt: "2026-08-06T08:00:00.000Z",
  },
  {
    id: "proj-ormlite",
    name: "Ormlite Compiler",
    category: "infrastructure",
    description: "A demo compiler toolchain tracking developer releases and repository momentum.",
    metrics: {
      tvl: 0,
      volume24h: 0,
      activeUsers24h: 3_100,
      developerActivity: 22,
    },
    evidenceIds: ["evidence-developer"],
    updatedAt: "2026-08-06T08:30:00.000Z",
  },
];

export const projectById: Record<string, Project> = Object.fromEntries(
  projects.map((project) => [project.id, project]),
);
