import { STATUS_WEIGHT } from "@insight/core";
import type { Evidence, Narrative, Project } from "@insight/core";
import type { AdjacencyIndex, Entity, KnowledgeGraph, Relationship } from "./models";
import { compareRelationships } from "./models";

/**
 * GraphBuilder — constructs a deterministic {@link KnowledgeGraph} from
 * domain objects (projects, evidence, narratives).
 *
 * The builder is a pure function: identical inputs always produce identical
 * graphs. Node and edge ordering is normalized (sorted) so downstream
 * traversal and resolution are reproducible.
 *
 * STATUS_WEIGHT is imported from @insight/core — the single source of
 * truth shared by core, intelligence, and knowledge.
 */

/**
 * Build a knowledge graph from the given domain data.
 */
export function buildKnowledgeGraph(input: {
  projects: readonly Project[];
  evidence: readonly Evidence[];
  narratives: readonly Narrative[];
}): KnowledgeGraph {
  const entities = new Map<string, Entity>();
  const relationships: Relationship[] = [];

  // Evidence entities + evidence -> source edges.
  for (const item of input.evidence) {
    entities.set(item.id, {
      kind: "evidence",
      id: item.id,
      sourceId: item.source.id,
      note: item.note,
      status: item.status,
    });

    relationships.push({
      type: "sources",
      from: item.id,
      to: item.source.id,
      weight: statusWeight(item.status),
    });
  }

  // Source entities referenced by evidence.
  for (const item of input.evidence) {
    entities.set(item.source.id, {
      kind: "source",
      id: item.source.id,
      name: item.source.name,
    });
  }

  // Project entities + project -> evidence edges.
  for (const project of input.projects) {
    entities.set(project.id, {
      kind: "project",
      id: project.id,
      name: project.name,
      category: project.category,
    });

    for (const evidenceId of project.evidenceIds) {
      const evidence = input.evidence.find((item) => item.id === evidenceId);
      if (evidence !== undefined) {
        relationships.push({
          type: "backs",
          from: project.id,
          to: evidenceId,
          weight: statusWeight(evidence.status),
        });
      }
    }
  }

  // Narrative entities + edges.
  for (const narrative of input.narratives) {
    entities.set(narrative.id, {
      kind: "narrative",
      id: narrative.id,
      name: narrative.name,
      trend: narrative.trend,
    });

    for (const projectId of narrative.projectIds) {
      relationships.push({
        type: "features",
        from: narrative.id,
        to: projectId,
        weight: narrativeWeight(narrative),
      });
    }

    for (const evidenceId of narrative.evidenceIds) {
      relationships.push({
        type: "supports",
        from: narrative.id,
        to: evidenceId,
        weight: narrativeWeight(narrative),
      });
    }
  }

  const sorted = [...relationships].sort(compareRelationships);
  return {
    entities,
    adjacency: buildAdjacency(sorted),
    relationships: sorted,
  };
}

function statusWeight(status: Evidence["status"]): number {
  return STATUS_WEIGHT[status] ?? 0;
}

function narrativeWeight(narrative: Narrative): number {
  const trendWeight: Record<Narrative["trend"], number> = {
    up: 1,
    flat: 0.6,
    watch: 0.5,
    down: 0.3,
  };
  return trendWeight[narrative.trend] ?? 0.5;
}

/** Build a deterministic adjacency index from sorted edges. */
function buildAdjacency(sorted: readonly Relationship[]): AdjacencyIndex {
  const adjacency = new Map<string, Relationship[]>();
  for (const edge of sorted) {
    const bucket = adjacency.get(edge.from) ?? [];
    bucket.push(edge);
    adjacency.set(edge.from, bucket);
  }
  return adjacency;
}
